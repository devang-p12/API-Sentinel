import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';
import * as dns from 'node:dns';

// Ensure IPv4 DNS resolution is prioritized across cloud containers (e.g. Render)
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Ignore on environments where method is unsupported
}

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
export class EmailProviderService implements EmailProvider, OnModuleInit {
  private readonly logger = new Logger(EmailProviderService.name);

  private readonly providerType: 'development' | 'smtp' | 'resend';
  private readonly isGmail: boolean;
  private readonly smtpHost: string;
  private readonly smtpPort: number;
  private readonly smtpUser?: string;
  private readonly smtpPassword?: string;
  private readonly defaultFrom: string;
  private transporter?: nodemailer.Transporter;
  private resendClient?: Resend;

  constructor() {
    const rawProvider = (process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
    const rawHost = (process.env.EMAIL_HOST || '').trim().replace(/^["']|["']$/g, '');
    const rawUser = (process.env.EMAIL_USER || '').trim().replace(/^["']|["']$/g, '');
    // Clean password: strip quotes and any whitespace / spaces
    const rawPass = (process.env.EMAIL_PASSWORD || '').trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '');
    const rawFrom = (process.env.EMAIL_FROM || '').trim().replace(/^["']|["']$/g, '');
    const resendApiKey = (process.env.RESEND_API_KEY || '').trim().replace(/^["']|["']$/g, '');

    this.isGmail =
      rawProvider === 'gmail' ||
      rawHost.toLowerCase().includes('gmail') ||
      rawUser.toLowerCase().includes('@gmail.com') ||
      rawUser.toLowerCase().includes('@googlemail.com');

    // Auto-detect provider
    if (rawProvider === 'resend' || (resendApiKey && !rawUser && !rawHost)) {
      this.providerType = 'resend';
    } else if (
      rawProvider === 'smtp' ||
      rawProvider === 'gmail' ||
      this.isGmail ||
      rawHost.length > 0 ||
      (rawUser.length > 0 && rawPass.length > 0)
    ) {
      this.providerType = 'smtp';
    } else {
      this.providerType = 'development';
    }

    this.smtpHost = rawHost || (this.isGmail ? 'smtp.gmail.com' : '');
    this.smtpPort = process.env.EMAIL_PORT
      ? parseInt(process.env.EMAIL_PORT.trim(), 10)
      : process.env.EMAIL_SECURE === 'true'
      ? 465
      : 587;
    this.smtpUser = rawUser.length > 0 ? rawUser : undefined;
    this.smtpPassword = rawPass.length > 0 ? rawPass : undefined;
    this.defaultFrom = rawFrom || this.smtpUser || 'onboarding@resend.dev';

    const effectiveResendKey = resendApiKey || (this.smtpUser === 'resend' ? this.smtpPassword : undefined);
    if (effectiveResendKey) {
      this.resendClient = new Resend(effectiveResendKey);
    }

    if (this.providerType === 'smtp') {
      this.transporter = this.createTransporter();
    }
  }

  onModuleInit() {
    this.logger.log(
      `[EmailProvider] Initialized mode: ${this.providerType.toUpperCase()} | Host: ${
        this.isGmail ? 'Gmail Service' : this.smtpHost || 'None'
      } | User: ${this.smtpUser || 'Anonymous'} | Default From: ${this.defaultFrom}`,
    );

    if (this.providerType === 'smtp' && this.transporter) {
      // Non-blocking verification check in background
      this.transporter
        .verify()
        .then(() => {
          this.logger.log(
            `[EmailProvider] SMTP connection verified successfully for ${
              this.isGmail ? 'Gmail Service' : this.smtpHost
            }`,
          );
        })
        .catch((err) => {
          this.logger.warn(
            `[EmailProvider] SMTP transport verification warning: ${err.message} (code: ${err.code || 'UNKNOWN'})`,
          );
        });
    }
  }

  private createTransporter(): nodemailer.Transporter {
    const transportOptions: any = {
      family: 4, // CRITICAL: Cloud containers (Render) lack IPv6 egress routing. Force IPv4.
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      tls: {
        rejectUnauthorized: false,
      },
    };

    if (this.isGmail) {
      // Nodemailer built-in Gmail preset
      transportOptions.service = 'gmail';
      if (this.smtpUser && this.smtpPassword) {
        transportOptions.auth = {
          user: this.smtpUser,
          pass: this.smtpPassword,
        };
      }
    } else {
      transportOptions.host = this.smtpHost;
      transportOptions.port = this.smtpPort;
      transportOptions.secure = process.env.EMAIL_SECURE === 'true' || this.smtpPort === 465;

      if (this.smtpUser && this.smtpPassword) {
        transportOptions.auth = {
          user: this.smtpUser,
          pass: this.smtpPassword,
        };
      }
    }

    return nodemailer.createTransport(transportOptions);
  }

  async sendEmail(options: EmailSendOptions): Promise<EmailProviderResult> {
    let from = options.from || this.defaultFrom;
    const recipients = options.to.filter((email) => email && email.trim().length > 0);

    if (recipients.length === 0) {
      return {
        success: false,
        error: 'No valid recipients specified',
        provider: this.providerType,
      };
    }

    // If using Gmail and sender hasn't set display name, format nicely with Sentinel brand
    if (this.isGmail && this.smtpUser && (!from || from.includes('resend.dev') || from === this.smtpUser)) {
      from = `"API Sentinel" <${this.smtpUser}>`;
    }

    if (this.providerType === 'resend' || (this.resendClient && !this.smtpHost && !this.isGmail)) {
      return this.sendViaResend(recipients, from, options);
    }

    if (this.providerType === 'smtp') {
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
        this.transporter = this.createTransporter();
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
      const providerLabel = this.isGmail ? 'Gmail Service' : `${this.smtpHost}:${this.smtpPort}`;
      const codeInfo = err.code ? ` [code: ${err.code}]` : '';
      this.logger.error(
        `[SMTP] Failed to send email via ${providerLabel}: ${err.message}${codeInfo}`,
        err.stack,
      );
      return {
        success: false,
        error: `SMTP delivery failed: ${err.message}${codeInfo}`,
        provider: 'smtp',
      };
    }
  }
}


