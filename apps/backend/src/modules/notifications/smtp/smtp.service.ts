import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  messageId?: string;
}

export interface SendMailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  isMock: boolean;
}

@Injectable()
export class SmtpService {
  private readonly logger = new Logger(SmtpService.name);
  private transporter: nodemailer.Transporter;
  private readonly isMockMode: boolean;
  private readonly fromHeader: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<string>('SMTP_PORT')) || 587;
    const secure = this.configService.get<string>('SMTP_SECURE') === 'true';
    const user = this.configService.get<string>('SMTP_USER');
    const pass =
      this.configService.get<string>('SMTP_PASSWORD') ||
      this.configService.get<string>('SMTP_PASS');
    const fromName = this.configService.get<string>('SMTP_FROM_NAME') || 'MexAgenda Institucional';
    const fromEmail = this.configService.get<string>('SMTP_FROM_EMAIL') || 'no-reply@institucion.gob.mx';

    this.fromHeader = `"${fromName}" <${fromEmail}>`;

    const hasRealCredentials = Boolean(
      host &&
      user &&
      pass &&
      user !== 'placeholder_smtp_user' &&
      !host.includes('placeholder')
    );

    if (hasRealCredentials) {
      this.isMockMode = false;
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
        connectionTimeout: 10000,
      });
      this.logger.log(`[SMTP] Transporter activo conectado a host: ${host}:${port}`);
    } else {
      this.isMockMode = true;
      // Transporter seguro de pruebas (captura mensajes en memoria sin salir a la red)
      this.transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
      this.logger.log('[SMTP] Modo Mock Transporter activado (sin credenciales SMTP reales configuradas)');
    }
  }

  public isMock(): boolean {
    return this.isMockMode;
  }

  public async sendMail(options: SendMailOptions): Promise<SendMailResult> {
    if (!options.to || !this.isValidEmail(options.to)) {
      this.logger.warn(`[SMTP] Dirección de correo inválida: ${options.to}`);
      return {
        success: false,
        error: 'Dirección de correo electrónico del destinatario no válida',
        isMock: this.isMockMode,
      };
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.fromHeader,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
        messageId: options.messageId,
      });

      this.logger.log(
        `[SMTP] Correo despachado exitosamente a ${this.maskEmail(options.to)} | Mensaje ID: ${info.messageId || 'mock-id'}`
      );

      return {
        success: true,
        messageId: info.messageId || `mock-${Date.now()}`,
        isMock: this.isMockMode,
      };
    } catch (err: any) {
      const sanitizedError = err?.message ? String(err.message).replace(/[^\w\s\.\:\-]/g, '') : 'Error en envío SMTP';
      this.logger.error(`[SMTP] Fallo en despacho a ${this.maskEmail(options.to)}: ${sanitizedError}`);

      return {
        success: false,
        error: sanitizedError,
        isMock: this.isMockMode,
      };
    }
  }

  private isValidEmail(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  private maskEmail(email: string): string {
    const parts = email.split('@');
    if (parts.length !== 2) return '***@***';
    const name = parts[0];
    const domain = parts[1];
    const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : '***';
    return `${maskedName}@${domain}`;
  }
}

