import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SmtpService } from './smtp/smtp.service';
import { OutboxWorkerService } from './queue/outbox-worker.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-preferences.dto';
import { DispatchNotificationOptions } from './dto/create-notification.dto';
import { NotificationType, NotificationPreference, AuditOutcome } from '@prisma/client';
import {
  renderMeetingInviteEmail,
  renderMeetingUpdateEmail,
  renderMeetingCancelEmail,
  renderAgreementNewEmail,
  renderAgreementUpdateEmail,
  renderMinutesPublishedEmail,
  renderGeneralNotificationEmail,
} from './templates/email-templates';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly smtpService: SmtpService,
    private readonly outboxWorker: OutboxWorkerService,
  ) {}

  /**
   * Obtiene o crea por defecto las preferencias de notificación de un usuario.
   */
  async getOrCreatePreferences(userId: string): Promise<NotificationPreference> {
    let pref = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!pref) {
      pref = await this.prisma.notificationPreference.create({
        data: {
          userId,
          emailEnabled: true,
          inAppEnabled: true,
          meetingAlerts: true,
          agreementAlerts: true,
          minutesAlerts: true,
          generalAlerts: true,
        },
      });
    }

    return pref;
  }

  /**
   * Actualiza las preferencias de notificación de un usuario.
   */
  async updatePreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreference> {
    await this.getOrCreatePreferences(userId);

    const updated = await this.prisma.notificationPreference.update({
      where: { userId },
      data: {
        ...(dto.emailEnabled !== undefined && { emailEnabled: dto.emailEnabled }),
        ...(dto.inAppEnabled !== undefined && { inAppEnabled: dto.inAppEnabled }),
        ...(dto.meetingAlerts !== undefined && { meetingAlerts: dto.meetingAlerts }),
        ...(dto.agreementAlerts !== undefined && { agreementAlerts: dto.agreementAlerts }),
        ...(dto.minutesAlerts !== undefined && { minutesAlerts: dto.minutesAlerts }),
        ...(dto.generalAlerts !== undefined && { generalAlerts: dto.generalAlerts }),
      },
    });

    await this.auditService.logEvent({
      action: 'NOTIFICATION_PREFERENCES_UPDATED',
      outcome: AuditOutcome.SUCCESS,
      actorId: userId,
      entity: 'NOTIFICATION_PREFERENCE',
      entityId: updated.id,
      diffPayload: { changes: dto },
    });

    return updated;
  }

  /**
   * Despacha una notificación interna y opcionalmente programa el correo electrónico
   * respetando rigurosamente las preferencias del usuario receptor.
   */
  async dispatchNotification(options: DispatchNotificationOptions): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: options.userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!user) {
      this.logger.warn(`[Notifications] Usuario destinatario no encontrado: ${options.userId}`);
      return null;
    }

    const pref = await this.getOrCreatePreferences(options.userId);

    // Evaluar si la categoría está habilitada en preferencias
    const isCategoryEnabled = this.isCategoryAlertEnabled(options.type, pref);
    if (!isCategoryEnabled && !options.forceEmail) {
      this.logger.log(
        `[Notifications] Notificación ${options.type} descartada para usuario ${user.email} por preferencias personales`,
      );
      return null;
    }

    let notificationId: string | null = null;

    // 1. Notificación In-App
    if (pref.inAppEnabled) {
      const notif = await this.prisma.notification.create({
        data: {
          userId: options.userId,
          type: options.type,
          title: options.title,
          message: options.message,
          resourceType: options.resourceType,
          resourceId: options.resourceId,
          actionUrl: options.actionUrl,
          metadata: options.metadata || {},
          isRead: false,
        },
      });
      notificationId = notif.id;
    }

    // 2. Notificación vía Correo Electrónico (Outbox asíncrono)
    if (pref.emailEnabled || options.forceEmail) {
      const recipientEmail = options.recipientEmail || user.email;
      const recipientName = `${user.firstName} ${user.lastName}`;

      // Clave de idempotencia única: usuario + tipo + recurso + minuto actual (o clave explícita)
      const minuteBucket = Math.floor(Date.now() / 60000);
      const idempotencyKey =
        options.idempotencyKey ||
        `${options.userId}_${options.type}_${options.resourceId || 'gen'}_${minuteBucket}`;

      const emailPayload = this.generateEmailPayload(options, recipientName);

      // Si se creó notificación in-app la enlazamos, sino creamos un registro dummy de referencia
      let targetNotificationId = notificationId;
      if (!targetNotificationId) {
        const minimalNotif = await this.prisma.notification.create({
          data: {
            userId: options.userId,
            type: options.type,
            title: options.title,
            message: options.message,
            resourceType: options.resourceType,
            resourceId: options.resourceId,
            actionUrl: options.actionUrl,
            isRead: true, // Si el usuario desactivó in-app, se marca leída
          },
        });
        targetNotificationId = minimalNotif.id;
      }

      await this.outboxWorker.enqueueEmailDelivery({
        notificationId: targetNotificationId,
        recipientEmail,
        subject: emailPayload.subject,
        html: emailPayload.html,
        text: emailPayload.text,
        idempotencyKey,
      });
    }

    return notificationId;
  }

  /**
   * Consulta paginada de notificaciones del usuario autenticado (con protección IDOR estricta).
   */
  async findAll(userId: string, query: QueryNotificationsDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      userId, // STRICT IDOR FILTER
    };

    if (query.isRead !== undefined) {
      where.isRead = query.isRead;
    }

    if (query.type) {
      where.type = query.type;
    }

    const [total, data] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Contador de notificaciones no leídas para la campana en la navegación.
   */
  async getUnreadCount(userId: string): Promise<{ unreadCount: number }> {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return { unreadCount: count };
  }

  /**
   * Marca una notificación individual como leída (con verificación de propiedad).
   */
  async markAsRead(id: string, userId: string) {
    const notif = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notif) {
      throw new NotFoundException('Notificación no encontrada');
    }

    // Comprobación IDOR / BOLA estricta
    if (notif.userId !== userId) {
      throw new ForbiddenException('No tiene permisos para modificar esta notificación');
    }

    if (notif.isRead) {
      return notif;
    }

    return this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Marca todas las notificaciones pendientes del usuario como leídas.
   */
  async markAllAsRead(userId: string): Promise<{ updatedCount: number }> {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { updatedCount: result.count };
  }

  /**
   * Elimina o descarta una notificación propia.
   */
  async delete(id: string, userId: string): Promise<void> {
    const notif = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notif) {
      throw new NotFoundException('Notificación no encontrada');
    }

    // Comprobación IDOR / BOLA estricta
    if (notif.userId !== userId) {
      throw new ForbiddenException('No tiene permisos para eliminar esta notificación');
    }

    await this.prisma.notification.delete({
      where: { id },
    });
  }

  /**
   * Consulta administrativa de entregas en outbox (solo para ROLE_ADMIN).
   */
  async getAdminDeliveries(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [total, items] = await Promise.all([
      this.prisma.notificationDelivery.count(),
      this.prisma.notificationDelivery.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          notification: {
            select: {
              title: true,
              type: true,
              userId: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Reintento administrativo de una entrega fallida.
   */
  async retryDelivery(deliveryId: string, adminUserId: string) {
    const success = await this.outboxWorker.retryDelivery(deliveryId);
    if (!success) {
      throw new NotFoundException('Registro de entrega no encontrado');
    }

    await this.auditService.logEvent({
      action: 'NOTIFICATION_DELIVERY_RETRY_TRIGGERED',
      outcome: AuditOutcome.SUCCESS,
      actorId: adminUserId,
      entity: 'NOTIFICATION_DELIVERY',
      entityId: deliveryId,
    });

    return { success: true, message: 'Entrega reprogramada en cola' };
  }

  // ==============================================================================
  // DISPARADORES INSTITUCIONALES TRANSVERSALES CON GARANTÍA DE PRIVACIDAD
  // ==============================================================================

  /**
   * Notifica la convocatoria formal a los integrantes de una reunión.
   */
  async notifyMeetingConvocatoria(meetingId: string): Promise<void> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        category: true,
        participants: {
          select: { userId: true },
        },
      },
    });

    if (!meeting) return;

    for (const p of meeting.participants) {
      if (!p.userId) continue;
      await this.dispatchNotification({
        userId: p.userId,
        type: NotificationType.REUNION_CONVOCATORIA,
        title: `Convocatoria: ${meeting.title}`,
        message: `Ha sido formalmente convocado a la sesión institucional programada para el ${meeting.meetingDate.toLocaleDateString('es-MX')}.`,
        resourceType: 'MEETING',
        resourceId: meeting.id,
        actionUrl: `/meetings/${meeting.id}`,
        metadata: {
          meetingTitle: meeting.title,
          meetingDate: meeting.meetingDate,
          modality: meeting.modality,
          categoryName: meeting.category?.name,
        },
      });
    }
  }

  /**
   * Notifica la modificación de una reunión a sus participantes.
   */
  async notifyMeetingUpdate(meetingId: string, changeDetails: string): Promise<void> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        participants: { select: { userId: true } },
      },
    });

    if (!meeting) return;

    for (const p of meeting.participants) {
      if (!p.userId) continue;
      await this.dispatchNotification({
        userId: p.userId,
        type: NotificationType.REUNION_MODIFICADA,
        title: `Actualización de Sesión: ${meeting.title}`,
        message: `Se han actualizado los detalles de la sesión. ${changeDetails}`,
        resourceType: 'MEETING',
        resourceId: meeting.id,
        actionUrl: `/meetings/${meeting.id}`,
        metadata: {
          meetingTitle: meeting.title,
          changeDetails,
          newDate: meeting.meetingDate,
        },
      });
    }
  }

  /**
   * Notifica la cancelación de una reunión a sus participantes.
   */
  async notifyMeetingCancelled(meetingId: string, reason: string): Promise<void> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        participants: { select: { userId: true } },
      },
    });

    if (!meeting) return;

    for (const p of meeting.participants) {
      if (!p.userId) continue;
      await this.dispatchNotification({
        userId: p.userId,
        type: NotificationType.REUNION_CANCELADA,
        title: `Cancelación de Sesión: ${meeting.title}`,
        message: `La sesión institucional ha sido cancelada. Motivo: ${reason}`,
        resourceType: 'MEETING',
        resourceId: meeting.id,
        actionUrl: `/meetings`,
        metadata: {
          meetingTitle: meeting.title,
          reason,
        },
      });
    }
  }

  /**
   * Notifica la asignación de un acuerdo institucional.
   */
  async notifyAgreementAssigned(agreementId: string): Promise<void> {
    const agreement = await this.prisma.agreement.findUnique({
      where: { id: agreementId },
      include: {
        collaborators: { select: { userId: true } },
      },
    });

    if (!agreement) return;

    // 1. Notificar al responsable titular
    if (agreement.assignedToId) {
      await this.dispatchNotification({
        userId: agreement.assignedToId,
        type: NotificationType.ACUERDO_ASIGNADO,
        title: `Nuevo Acuerdo Asignado: ${agreement.title}`,
        message: `Ha sido designado como Responsable Titular del acuerdo "${agreement.title}". Fecha límite: ${agreement.dueDate ? agreement.dueDate.toLocaleDateString('es-MX') : 'No especificada'}.`,
        resourceType: 'AGREEMENT',
        resourceId: agreement.id,
        actionUrl: `/agreements/${agreement.id}`,
        metadata: {
          agreementTitle: agreement.title,
          role: 'RESPONSABLE',
          priority: agreement.priority,
          dueDate: agreement.dueDate,
        },
      });
    }

    // 2. Notificar a los colaboradores asignados
    for (const colab of agreement.collaborators) {
      if (colab.userId !== agreement.assignedToId) {
        await this.dispatchNotification({
          userId: colab.userId,
          type: NotificationType.ACUERDO_ASIGNADO,
          title: `Colaboración en Acuerdo: ${agreement.title}`,
          message: `Ha sido incorporado como Colaborador en el acuerdo "${agreement.title}".`,
          resourceType: 'AGREEMENT',
          resourceId: agreement.id,
          actionUrl: `/agreements/${agreement.id}`,
          metadata: {
            agreementTitle: agreement.title,
            role: 'COLABORADOR',
            priority: agreement.priority,
          },
        });
      }
    }
  }

  /**
   * Notifica actualización o cambio de estado de un acuerdo.
   */
  async notifyAgreementStatusChanged(
    agreementId: string,
    previousStatus: string,
    newStatus: string,
  ): Promise<void> {
    const agreement = await this.prisma.agreement.findUnique({
      where: { id: agreementId },
      include: {
        collaborators: { select: { userId: true } },
      },
    });

    if (!agreement) return;

    const recipients = new Set<string>();
    if (agreement.createdById) recipients.add(agreement.createdById);
    if (agreement.assignedToId) recipients.add(agreement.assignedToId);
    agreement.collaborators.forEach((c) => recipients.add(c.userId));

    for (const userId of recipients) {
      await this.dispatchNotification({
        userId,
        type: NotificationType.ACUERDO_ESTADO_CAMBIO,
        title: `Cambio de Estado de Acuerdo: ${agreement.title}`,
        message: `El acuerdo ha cambiado de estado de ${previousStatus} a ${newStatus}.`,
        resourceType: 'AGREEMENT',
        resourceId: agreement.id,
        actionUrl: `/agreements/${agreement.id}`,
        metadata: {
          agreementTitle: agreement.title,
          previousStatus,
          newStatus,
        },
      });
    }
  }

  /**
   * Notifica la publicación formal de un acta oficial de sesión.
   */
  async notifyMinutesPublished(meetingId: string, minutesId: string): Promise<void> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        participants: { select: { userId: true } },
      },
    });

    if (!meeting) return;

    for (const p of meeting.participants) {
      if (!p.userId) continue;
      await this.dispatchNotification({
        userId: p.userId,
        type: NotificationType.ACTA_PUBLICADA,
        title: `Acta Oficial Publicada: ${meeting.title}`,
        message: `Se ha publicado el acta oficial de la sesión colegiada para su consulta y archivo patrimonial.`,
        resourceType: 'MEETING',
        resourceId: meeting.id,
        actionUrl: `/meetings/${meeting.id}`,
        metadata: {
          meetingTitle: meeting.title,
          minutesId,
        },
      });
    }
  }

  /**
   * Notifica una anotación compartida.
   * REGLA DE SEGURIDAD CRÍTICA:
   * NUNCA notificar si la nota es PRIVADA. Se verifica rigurosamente la visibilidad.
   */
  async notifyNoteShared(noteId: string): Promise<void> {
    const note = await this.prisma.personalNote.findUnique({
      where: { id: noteId },
    });

    if (!note) return;

    // PROTECCIÓN DE MÁXIMA CONFIDENCIALIDAD:
    if (note.visibility === 'PRIVADA') {
      this.logger.warn(
        `[SEGURIDAD] Intento interceptado de notificar una nota con visibilidad PRIVADA (ID: ${noteId}). Operación abortada.`,
      );
      throw new BadRequestException('Las notas privadas no pueden emitir notificaciones institucionales.');
    }

    if (note.visibility === 'REUNION' && note.meetingId) {
      // Notificar únicamente a los integrantes de la sesión
      const participants = await this.prisma.meetingParticipant.findMany({
        where: { meetingId: note.meetingId },
        select: { userId: true },
      });

      for (const p of participants) {
        if (p.userId && p.userId !== note.authorId) {
          await this.dispatchNotification({
            userId: p.userId,
            type: NotificationType.NOTA_COMPARTIDA,
            title: `Nueva Nota Compartida de Sesión`,
            message: `Se ha compartido una nota colaborativa en el marco de la sesión colegiada.`,
            resourceType: 'NOTE',
            resourceId: note.id,
            actionUrl: `/notes/${note.id}`,
          });
        }
      }
    }
  }

  // ==============================================================================
  // MÉTODOS AUXILIARES PRIVADOS
  // ==============================================================================

  private isCategoryAlertEnabled(type: NotificationType, pref: NotificationPreference): boolean {
    switch (type) {
      case NotificationType.REUNION_CONVOCATORIA:
      case NotificationType.REUNION_MODIFICADA:
      case NotificationType.REUNION_CANCELADA:
        return pref.meetingAlerts;

      case NotificationType.ACUERDO_ASIGNADO:
      case NotificationType.ACUERDO_ACTUALIZADO:
      case NotificationType.ACUERDO_ESTADO_CAMBIO:
        return pref.agreementAlerts;

      case NotificationType.ACTA_PUBLICADA:
        return pref.minutesAlerts;

      default:
        return pref.generalAlerts;
    }
  }

  private generateEmailPayload(
    options: DispatchNotificationOptions,
    recipientName: string,
  ): { html: string; text: string; subject: string } {
    const appUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const fullActionUrl = options.actionUrl
      ? options.actionUrl.startsWith('http')
        ? options.actionUrl
        : `${appUrl}${options.actionUrl}`
      : appUrl;

    switch (options.type) {
      case NotificationType.REUNION_CONVOCATORIA:
        return renderMeetingInviteEmail({
          recipientName,
          meetingTitle: options.metadata?.meetingTitle || options.title,
          organName: options.metadata?.categoryName,
          dateStr: options.metadata?.meetingDate
            ? new Date(options.metadata.meetingDate).toLocaleDateString('es-MX')
            : 'Por confirmar',
          modality: options.metadata?.modality || 'PRESENCIAL',
          actionUrl: fullActionUrl,
        });

      case NotificationType.REUNION_MODIFICADA:
        return renderMeetingUpdateEmail({
          recipientName,
          meetingTitle: options.metadata?.meetingTitle || options.title,
          changeDetails: options.metadata?.changeDetails || options.message,
          newDateStr: options.metadata?.newDate
            ? new Date(options.metadata.newDate).toLocaleDateString('es-MX')
            : undefined,
          actionUrl: fullActionUrl,
        });

      case NotificationType.REUNION_CANCELADA:
        return renderMeetingCancelEmail({
          recipientName,
          meetingTitle: options.metadata?.meetingTitle || options.title,
          reason: options.metadata?.reason || options.message,
          actionUrl: fullActionUrl,
        });

      case NotificationType.ACUERDO_ASIGNADO:
        return renderAgreementNewEmail({
          recipientName,
          agreementTitle: options.metadata?.agreementTitle || options.title,
          role: options.metadata?.role || 'RESPONSABLE',
          priority: options.metadata?.priority || 'MEDIA',
          deadlineStr: options.metadata?.dueDate
            ? new Date(options.metadata.dueDate).toLocaleDateString('es-MX')
            : undefined,
          actionUrl: fullActionUrl,
        });

      case NotificationType.ACUERDO_ESTADO_CAMBIO:
      case NotificationType.ACUERDO_ACTUALIZADO:
        return renderAgreementUpdateEmail({
          recipientName,
          agreementTitle: options.metadata?.agreementTitle || options.title,
          status: options.metadata?.newStatus || 'ACTUALIZADO',
          changeSummary: options.message,
          actionUrl: fullActionUrl,
        });

      case NotificationType.ACTA_PUBLICADA:
        return renderMinutesPublishedEmail({
          recipientName,
          meetingTitle: options.metadata?.meetingTitle || options.title,
          sessionDateStr: new Date().toLocaleDateString('es-MX'),
          actionUrl: fullActionUrl,
        });

      default:
        return renderGeneralNotificationEmail({
          recipientName,
          title: options.title,
          message: options.message,
          actionUrl: fullActionUrl,
        });
    }
  }
}
