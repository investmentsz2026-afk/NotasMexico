import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import { SmtpService } from '../smtp/smtp.service';
import { DeliveryStatus, NotificationChannel, NotificationType } from '@prisma/client';
import {
  renderMeetingInviteEmail,
  renderMeetingUpdateEmail,
  renderMeetingCancelEmail,
  renderAgreementNewEmail,
  renderAgreementUpdateEmail,
  renderMinutesPublishedEmail,
  renderGeneralNotificationEmail,
} from '../templates/email-templates';

export interface EnqueueEmailDeliveryParams {
  notificationId: string;
  recipientEmail: string;
  subject: string;
  html: string;
  text?: string;
  idempotencyKey: string;
}

export interface WorkerHealthStatus {
  workerId: string;
  isActive: boolean;
  isProcessing: boolean;
  lastTickAt: string | null;
  totalProcessed: number;
  totalRecoveredStuck: number;
}

@Injectable()
export class OutboxWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorkerService.name);
  private readonly workerId = `worker-${crypto.randomUUID().slice(0, 8)}`;
  private workerInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private isShuttingDown = false;
  private lastTickAt: Date | null = null;
  private totalProcessed = 0;
  private totalRecoveredStuck = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly smtpService: SmtpService,
  ) {}

  onModuleInit() {
    this.isShuttingDown = false;
    this.logger.log(`[OutboxWorker:${this.workerId}] Inicializando procesador de entregas asíncronas outbox...`);
    // Ejecutar un ciclo cada 10 segundos
    this.workerInterval = setInterval(() => {
      if (this.isShuttingDown) return;
      this.processPendingDeliveries().catch((err) => {
        this.logger.error(`[OutboxWorker:${this.workerId}] Error no controlado en worker outbox: ${err.message}`);
      });
    }, 10000);
  }

  async onModuleDestroy() {
    this.isShuttingDown = true;
    if (this.workerInterval) {
      clearInterval(this.workerInterval);
      this.workerInterval = null;
    }
    const waitStart = Date.now();
    while (this.isProcessing && Date.now() - waitStart < 3000) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  /**
   * Devuelve el estado de salud y telemetría del worker (para supervisión de proceso continuo).
   */
  getWorkerHealth(): WorkerHealthStatus {
    return {
      workerId: this.workerId,
      isActive: this.workerInterval !== null,
      isProcessing: this.isProcessing,
      lastTickAt: this.lastTickAt ? this.lastTickAt.toISOString() : null,
      totalProcessed: this.totalProcessed,
      totalRecoveredStuck: this.totalRecoveredStuck,
    };
  }

  /**
   * Recupera entregas atascadas en estado EN_PROCESO que hayan excedido el umbral de tiempo
   * (OBS-07-02: recuperación ante caída o reinicio inesperado de instancia de worker).
   */
  async recoverStuckDeliveries(staleThresholdMinutes = 15): Promise<{ recovered: number; failedPermanently: number }> {
    const thresholdDate = new Date(Date.now() - staleThresholdMinutes * 60 * 1000);

    const stuckDeliveries = await this.prisma.notificationDelivery.findMany({
      where: {
        status: DeliveryStatus.EN_PROCESO,
        nextAttemptAt: { lte: thresholdDate },
      },
    });

    if (stuckDeliveries.length === 0) {
      return { recovered: 0, failedPermanently: 0 };
    }

    let recovered = 0;
    let failedPermanently = 0;

    for (const stuck of stuckDeliveries) {
      const nextAttempts = stuck.attempts + 1;
      const isExhausted = nextAttempts >= stuck.maxAttempts;

      const updated = await this.prisma.notificationDelivery.updateMany({
        where: {
          id: stuck.id,
          status: DeliveryStatus.EN_PROCESO,
        },
        data: {
          attempts: nextAttempts,
          status: isExhausted ? DeliveryStatus.FALLIDO : DeliveryStatus.PENDIENTE,
          failedAt: isExhausted ? new Date() : null,
          nextAttemptAt: new Date(),
          errorMessage: isExhausted
            ? `Entrega abortada tras superar maxAttempts (${stuck.maxAttempts}) por bloqueo en EN_PROCESO (> ${staleThresholdMinutes}m)`
            : `Entrega recuperada automáticamente de estado EN_PROCESO huérfano (> ${staleThresholdMinutes}m)`,
        },
      });

      if (updated.count > 0) {
        this.totalRecoveredStuck++;
        if (isExhausted) {
          failedPermanently++;
        } else {
          recovered++;
        }
      }
    }

    if (recovered > 0 || failedPermanently > 0) {
      this.logger.warn(
        `[OutboxWorker:${this.workerId}] Barrido EN_PROCESO: ${recovered} reencoladas a PENDIENTE, ${failedPermanently} marcadas FALLIDO.`,
      );
    }

    return { recovered, failedPermanently };
  }

  /**
   * Encola una entrega de correo en el Transactional Outbox de manera idempotente.
   */
  async enqueueEmailDelivery(params: EnqueueEmailDeliveryParams): Promise<string> {
    const existing = await this.prisma.notificationDelivery.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });

    if (existing) {
      this.logger.log(`[OutboxWorker] Trabajo duplicado ignorado por idempotencia: ${params.idempotencyKey}`);
      return existing.id;
    }

    const delivery = await this.prisma.notificationDelivery.create({
      data: {
        notificationId: params.notificationId,
        channel: NotificationChannel.EMAIL,
        recipientEmail: params.recipientEmail,
        subject: params.subject,
        htmlBody: params.html,
        textBody: params.text,
        status: DeliveryStatus.PENDIENTE,
        attempts: 0,
        maxAttempts: 3,
        nextAttemptAt: new Date(),
        idempotencyKey: params.idempotencyKey,
      },
    });

    this.logger.log(`[OutboxWorker] Entrega encolada en Outbox ID: ${delivery.id} para ${params.recipientEmail}`);
    return delivery.id;
  }

  /**
   * Procesa las entregas pendientes en la tabla notification_deliveries.
   * Implementa reclamación atómica (OBS-07-01) para impedir que dos workers concurrentes
   * procesen la misma entrega.
   */
  async processPendingDeliveries(batchSize = 10): Promise<{ processed: number; success: number; failed: number }> {
    if (this.isProcessing) {
      return { processed: 0, success: 0, failed: 0 };
    }

    this.isProcessing = true;
    this.lastTickAt = new Date();
    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;

    try {
      // 0. Barrido preventivo de entregas huérfanas en EN_PROCESO (> 15 min)
      await this.recoverStuckDeliveries(15);

      const pendingJobs = await this.prisma.notificationDelivery.findMany({
        where: {
          status: DeliveryStatus.PENDIENTE,
          nextAttemptAt: { lte: new Date() },
          attempts: { lt: 3 },
        },
        include: {
          notification: {
            include: {
              user: {
                select: { firstName: true, lastName: true },
              },
            },
          },
        },
        orderBy: { nextAttemptAt: 'asc' },
        take: batchSize,
      });

      if (pendingJobs.length === 0) {
        return { processed: 0, success: 0, failed: 0 };
      }

      this.logger.log(`[OutboxWorker:${this.workerId}] Evaluando lote de ${pendingJobs.length} entregas candidatas...`);

      for (const job of pendingJobs) {
        if (this.isShuttingDown) {
          break;
        }
        // Reclamación atómica a nivel de fila en PostgreSQL (OBS-07-01):
        // Solo actualiza si status sigue siendo exactamente PENDIENTE.
        // Actualiza nextAttemptAt = new Date() como marca de inicio de procesamiento para OBS-07-02.
        const claimed = await this.prisma.notificationDelivery.updateMany({
          where: {
            id: job.id,
            status: DeliveryStatus.PENDIENTE,
          },
          data: {
            status: DeliveryStatus.EN_PROCESO,
            nextAttemptAt: new Date(),
          },
        });

        if (claimed.count === 0) {
          // Otro worker concurrente ya reclamó esta entrega; se omite limpiamente
          continue;
        }

        processedCount++;
        this.totalProcessed++;

        const recipientEmail = job.recipientEmail;
        if (!recipientEmail) {
          await this.prisma.notificationDelivery.update({
            where: { id: job.id },
            data: {
              status: DeliveryStatus.DESCARTADO,
              errorMessage: 'Falta correo electrónico del destinatario',
              failedAt: new Date(),
            },
          });
          failedCount++;
          continue;
        }

        // Message-ID determinista RFC 5322 derivado de idempotencyKey para deduplicación en MTA (OBS-07-02)
        const cleanKey = (job.idempotencyKey || job.id).replace(/[^a-zA-Z0-9._-]/g, '-');
        const deterministicMessageId = `<${cleanKey}@mexagenda.institucional.gob.mx>`;

        // Despacho a través de SmtpService con plantilla institucional HTML completa
        const emailContent = this.resolveEmailContent(job);
        const result = await this.smtpService.sendMail({
          to: recipientEmail,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
          messageId: deterministicMessageId,
        });

        if (result.success) {
          successCount++;
          await this.prisma.notificationDelivery.update({
            where: { id: job.id },
            data: {
              status: DeliveryStatus.ENVIADO,
              sentAt: new Date(),
              attempts: job.attempts + 1,
            },
          });
        } else {
          failedCount++;
          const newAttempts = job.attempts + 1;
          const isFinalFailure = newAttempts >= job.maxAttempts;

          // Backoff exponencial: 2^attempts minutos (ej. 2 min, 4 min)
          const delayMinutes = Math.pow(2, newAttempts);
          const nextAttempt = new Date(Date.now() + delayMinutes * 60 * 1000);

          await this.prisma.notificationDelivery.update({
            where: { id: job.id },
            data: {
              attempts: newAttempts,
              status: isFinalFailure ? DeliveryStatus.FALLIDO : DeliveryStatus.PENDIENTE,
              failedAt: isFinalFailure ? new Date() : null,
              nextAttemptAt: nextAttempt,
              errorMessage: result.error || 'Fallo desconocido en despacho SMTP',
            },
          });
        }
      }
    } catch (err: any) {
      this.logger.error(`[OutboxWorker:${this.workerId}] Error procesando entregas outbox: ${err.message}`);
    } finally {
      this.isProcessing = false;
    }

    return { processed: processedCount, success: successCount, failed: failedCount };
  }

  /**
   * Reintento administrativo manual para una entrega fallida.
   */
  async retryDelivery(deliveryId: string): Promise<boolean> {
    const delivery = await this.prisma.notificationDelivery.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery) {
      return false;
    }

    await this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: DeliveryStatus.PENDIENTE,
        attempts: 0,
        nextAttemptAt: new Date(),
        errorMessage: null,
      },
    });

    return true;
  }

  /**
   * Resuelve el contenido final del correo.
   * Si la entrega ya incluye htmlBody persistido en base de datos, lo utiliza directamente.
   * Si es nulo (retrocompatibilidad con entregas preexistentes), reconstruye dinámicamente
   * la plantilla institucional oficial según el tipo de notificación y metadatos.
   */
  private resolveEmailContent(job: any): { subject: string; html: string; text: string } {
    if (job.htmlBody && typeof job.htmlBody === 'string' && job.htmlBody.trim().length > 0) {
      return {
        subject: job.subject || job.notification?.title || 'Notificación Institucional MexAgenda',
        html: job.htmlBody,
        text: job.textBody || job.notification?.message || '',
      };
    }

    // Reconstrucción de respaldo para entregas previas sin payload HTML almacenado
    const notif = job.notification;
    const recipientName = notif?.user
      ? `${notif.user.firstName} ${notif.user.lastName}`.trim()
      : 'Estimado(a) Integrante Institucional';
    const meta = (notif?.metadata as any) || {};
    const appUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const actionUrl = notif?.actionUrl
      ? notif.actionUrl.startsWith('http')
        ? notif.actionUrl
        : `${appUrl}${notif.actionUrl}`
      : appUrl;

    switch (notif?.type) {
      case NotificationType.REUNION_CONVOCATORIA:
        return renderMeetingInviteEmail({
          recipientName,
          meetingTitle: meta.meetingTitle || notif?.title || 'Convocatoria a Sesión',
          organName: meta.categoryName,
          dateStr: meta.meetingDate
            ? new Date(meta.meetingDate).toLocaleDateString('es-MX')
            : 'Por confirmar',
          modality: meta.modality || 'PRESENCIAL',
          actionUrl,
        });

      case NotificationType.REUNION_MODIFICADA:
        return renderMeetingUpdateEmail({
          recipientName,
          meetingTitle: meta.meetingTitle || notif?.title || 'Sesión Colegiada',
          changeDetails: meta.changeDetails || notif?.message || 'Actualización de sesión',
          newDateStr: meta.newDate
            ? new Date(meta.newDate).toLocaleDateString('es-MX')
            : undefined,
          actionUrl,
        });

      case NotificationType.REUNION_CANCELADA:
        return renderMeetingCancelEmail({
          recipientName,
          meetingTitle: meta.meetingTitle || notif?.title || 'Sesión Colegiada',
          reason: meta.reason || notif?.message || 'Cancelación institucional programada',
          actionUrl,
        });

      case NotificationType.ACUERDO_ASIGNADO:
        return renderAgreementNewEmail({
          recipientName,
          agreementTitle: meta.agreementTitle || notif?.title || 'Acuerdo Institucional',
          role: meta.role || 'RESPONSABLE',
          priority: meta.priority || 'MEDIA',
          deadlineStr: meta.dueDate
            ? new Date(meta.dueDate).toLocaleDateString('es-MX')
            : undefined,
          actionUrl,
        });

      case NotificationType.ACUERDO_ESTADO_CAMBIO:
      case NotificationType.ACUERDO_ACTUALIZADO:
        return renderAgreementUpdateEmail({
          recipientName,
          agreementTitle: meta.agreementTitle || notif?.title || 'Acuerdo Institucional',
          status: meta.newStatus || 'ACTUALIZADO',
          changeSummary: notif?.message || 'Cambio de estado del acuerdo',
          actionUrl,
        });

      case NotificationType.ACTA_PUBLICADA:
        return renderMinutesPublishedEmail({
          recipientName,
          meetingTitle: meta.meetingTitle || notif?.title || 'Sesión Colegiada',
          sessionDateStr: new Date().toLocaleDateString('es-MX'),
          actionUrl,
        });

      default:
        return renderGeneralNotificationEmail({
          recipientName,
          title: notif?.title || 'Notificación Institucional',
          message: notif?.message || '',
          actionUrl,
        });
    }
  }
}

