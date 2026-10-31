import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';

export interface EmailSendOptions {
  to: string[];
  subject: string;
  text: string;
  html?: string;
  from?: string;
}

export interface EmailProviderResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: 'development' | 'smtp' | 'resend';
}

export interface EmailProvider {
  sendEmail(options: EmailSendOptions): Promise<EmailProviderResult>;
}

@Injectable()
export class EmailProviderService implements EmailProvider {
  private readonly logger = new Logger(EmailProviderService.name);

  private readonly providerType: 'development' | 'smtp' | 'resend';
  private readonly smtpHost: string;
  private readonly smtpPort: number;
  private readonly smtpUser?: string;
  private readonly smtpPassword?: string;
  private readonly defaultFrom: string;
  private transporter?: nodemailer.Transporter;
  private resendClient?: Resend;

  constructor() {
    this.providerType =
      (process.env.EMAIL_PROVIDER as 'development' | 'smtp' | 'resend') ||
      (process.env.RESEND_API_KEY
        ? 'resend'
        : process.env.EMAIL_HOST
        ? 'smtp'
        : 'development');

    this.smtpHost = process.env.EMAIL_HOST || '';
    this.smtpPort = process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : 587;
    this.smtpUser = process.env.EMAIL_USER;
    this.smtpPassword = process.env.EMAIL_PASSWORD;
    this.defaultFrom = process.env.EMAIL_FROM || 'onboarding@resend.dev';

    const resendApiKey = process.env.RESEND_API_KEY || (this.smtpUser === 'resend' ? this.smtpPassword : undefined);
    if (resendApiKey) {
      this.resendClient = new Resend(resendApiKey);
    }

    if (this.providerType === 'smtp' && this.smtpHost) {
      const transportOptions: any = {
        host: this.smtpHost,
        port: this.smtpPort,
        secure: process.env.EMAIL_SECURE === 'true' || this.smtpPort === 465,
        tls: {
          rejectUnauthorized: false, // Useful for self-hosted / local dev SMTP
        },
      };

      if (this.smtpUser && this.smtpPassword) {
        transportOptions.auth = {
          user: this.smtpUser,
          pass: this.smtpPassword,
        };
      }

      this.transporter = nodemailer.createTransport(transportOptions);
    }

    this.logger.log(
      `[EmailProvider] Initialized email provider with mode: ${this.providerType} (from: ${this.defaultFrom})`,
    );
  }

  async sendEmail(options: EmailSendOptions): Promise<EmailProviderResult> {
    const from = options.from || this.defaultFrom;
    const recipients = options.to.filter((email) => email && email.trim().length > 0);

    if (recipients.length === 0) {
      return {
        success: false,
        error: 'No valid recipients specified',
        provider: this.providerType,
      };
    }

    if (this.providerType === 'resend' || (this.resendClient && !this.smtpHost)) {
      return this.sendViaResend(recipients, from, options);
    }

    if (this.providerType === 'smtp' && this.smtpHost) {
      return this.sendViaSmtp(recipients, from, options);
    }

    return this.sendViaDevelopment(recipients, from, options);
  }

  private async sendViaResend(
    recipients: string[],
    from: string,
    options: EmailSendOptions,
  ): Promise<EmailProviderResult> {
    try {
      if (!this.resendClient) {
        throw new Error('Resend client is not initialized. Please configure RESEND_API_KEY.');
      }

      const response = await this.resendClient.emails.send({
        from,
        to: recipients,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      if (response.error) {
        this.logger.error(`[Resend] Delivery failed: ${response.error.message}`);
        return {
          success: false,
          error: response.error.message,
          provider: 'resend',
        };
      }

      this.logger.log(
        `[Resend] Dispatched email to ${recipients.join(', ')} (ID: ${response.data?.id})`,
      );

      return {
        success: true,
        messageId: response.data?.id,
        provider: 'resend',
      };
    } catch (err: any) {
      this.logger.error(`[Resend] Delivery exception: ${err.message}`);
      return {
        success: false,
        error: `Resend delivery failed: ${err.message}`,
        provider: 'resend',
      };
    }
  }

  private async sendViaDevelopment(
    recipients: string[],
    from: string,
    options: EmailSendOptions,
  ): Promise<EmailProviderResult> {
    const simulatedMessageId = `dev-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const logSeparator = '------------------------------------------------------------';
    this.logger.log(
      `\n[EMAIL DISPATCH: DEVELOPMENT MODE]\n${logSeparator}\n` +
        `Message ID: ${simulatedMessageId}\n` +
        `From:       ${from}\n` +
        `To:         ${recipients.join(', ')}\n` +
        `Subject:    ${options.subject}\n` +
        `${logSeparator}\n` +
        `${options.text}\n` +
        `${logSeparator}\n`,
    );

    return {
      success: true,
      messageId: simulatedMessageId,
      provider: 'development',
    };
  }

  private async sendViaSmtp(
    recipients: string[],
    from: string,
    options: EmailSendOptions,
  ): Promise<EmailProviderResult> {
    try {
      if (!this.transporter) {
        const transportOptions: any = {
          host: this.smtpHost,
          port: this.smtpPort,
          secure: process.env.EMAIL_SECURE === 'true' || this.smtpPort === 465,
          tls: {
            rejectUnauthorized: false,
          },
        };

        if (this.smtpUser && this.smtpPassword) {
          transportOptions.auth = {
            user: this.smtpUser,
            pass: this.smtpPassword,
          };
        }

        this.transporter = nodemailer.createTransport(transportOptions);
      }

      const info = await this.transporter.sendMail({
        from,
        to: recipients.join(', '),
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      this.logger.log(
        `[SMTP] Dispatched email to ${recipients.join(', ')} (Message ID: ${info.messageId})`,
      );

      return {
        success: true,
        messageId: info.messageId,
        provider: 'smtp',
      };
    } catch (err: any) {
      this.logger.error(
        `[SMTP] Failed to send email via SMTP ${this.smtpHost}:${this.smtpPort}: ${err.message}`,
      );
      return {
        success: false,
        error: `SMTP delivery failed: ${err.message}`,
        provider: 'smtp',
      };
    }
  }
}

