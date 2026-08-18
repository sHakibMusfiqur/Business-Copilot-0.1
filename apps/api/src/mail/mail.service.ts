import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { SentMessageInfo } from 'nodemailer';

import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { renderEmailTemplate, type BrandEmailContext } from '../settings/email-template';
import { buildEmailMessage, buildEmailText, type EmailType, type EmailTypeData } from './email-content';

export interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
  useSSL: boolean;
  configured: boolean;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  text?: string;
  html: string;
}

export interface SendOrgEmailOptions extends Omit<SendMailOptions, 'html' | 'subject' | 'text'> {
  type: EmailType;
  data?: EmailTypeData;
  subject?: string;
}

export interface SendMailResult {
  sent: boolean;
  reason?: 'smtp-not-configured' | 'send-failed';
}

const EMAIL_NAMESPACE = 'email';

const PLATFORM_BRAND: BrandEmailContext = {
  companyName: 'Business Copilot',
  tagline: '',
  primaryColor: '#3B82F6',
  secondaryColor: '#8B5CF6',
  accentColor: '#10B981',
  logoUrl: null,
  fontFamily: '',
  footerText: '',
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Resolves the organization's SMTP configuration from the `email` settings
   * namespace. The password is read directly from storage (never through the
   * sanitized settings API) so transactional mail can be sent.
   *
   * When the organization has no SMTP configured (e.g. the verification-code
   * email at registration, before any organization exists), the platform-level
   * SMTP from environment variables is used instead.
   */
  async getEmailConfig(orgId: string): Promise<EmailConfig> {
    const row = await this.prisma.organizationSettings.findUnique({
      where: { organizationId: orgId },
    });
    const settings =
      row?.settings && typeof row.settings === 'object'
        ? (row.settings as Record<string, unknown>)
        : {};
    const email =
      settings[EMAIL_NAMESPACE] && typeof settings[EMAIL_NAMESPACE] === 'object'
        ? (settings[EMAIL_NAMESPACE] as Record<string, unknown>)
        : {};

    const str = (key: string, fallback: string): string =>
      typeof email[key] === 'string' && (email[key] as string).trim()
        ? (email[key] as string).trim()
        : fallback;

    // A fully configured org-level SMTP always wins. Without one (new
    // registrations, platform mail), fall back to the platform SMTP so the
    // verification email can actually be delivered.
    const useOrgSmtp = Boolean(str('smtpHost', '') && str('fromEmail', ''));

    return {
      host: useOrgSmtp ? str('smtpHost', '') : this.config.smtpHost,
      port: useOrgSmtp
        ? typeof email.smtpPort === 'number'
          ? email.smtpPort
          : 587
        : this.config.smtpPort,
      user: useOrgSmtp ? str('smtpUsername', '') : this.config.smtpUser,
      pass: useOrgSmtp ? str('smtpPassword', '') : this.config.smtpPass,
      fromEmail: useOrgSmtp ? str('fromEmail', '') : this.config.smtpFromEmail,
      fromName: useOrgSmtp ? str('fromName', '') : this.config.smtpFromName,
      useSSL: useOrgSmtp ? email.useSSL === true : this.config.smtpSecure,
      configured: Boolean(
        (useOrgSmtp ? str('smtpHost', '') : this.config.smtpHost) &&
          (useOrgSmtp ? str('fromEmail', '') : this.config.smtpFromEmail),
      ),
    };
  }

  /**
   * Builds a branded HTML email for an organization and sends it through the
   * org's SMTP server. Branding (logo, name, colors, footer) is resolved
   * automatically for every email type, so callers never pass brand details.
   */
  async sendOrgEmail(orgId: string | null, options: SendOrgEmailOptions): Promise<SendMailResult> {
    const brand = orgId ? await this.settingsService.buildEmailBrand(orgId) : PLATFORM_BRAND;
    const { subject, content } = buildEmailMessage(options.type, brand, options.data);
    const html = renderEmailTemplate(brand, content);
    const text = buildEmailText({ subject, content });

    return this.sendMail(orgId ?? '', {
      to: options.to,
      subject: options.subject ?? subject,
      text,
      html,
    });
  }

  /**
   * Sends a branded HTML email using the org's SMTP settings. When SMTP is not
   * configured the email is logged for development instead of failing hard.
   */
  async sendMail(orgId: string, options: SendMailOptions): Promise<SendMailResult> {
    const config = await this.getEmailConfig(orgId);

    if (!config.configured) {
      this.logger.log(
        `SMTP not configured for org ${orgId || '(platform)'}; email to ${options.to} queued (${options.subject}). ` +
          'Email body is not logged to avoid exposing sensitive tokens or content.',
      );
      return { sent: false, reason: 'smtp-not-configured' };
    }

    let transporter: Transporter;
    try {
      transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.useSSL,
        auth: config.user ? { user: config.user, pass: config.pass } : undefined,
      });
    } catch (error) {
      this.logger.error(`Failed to build SMTP transport for org ${orgId}: ${(error as Error).message}`);
      return { sent: false, reason: 'send-failed' };
    }

    try {
      const info: SentMessageInfo = await transporter.sendMail({
        from: `"${config.fromName || 'Business Copilot'}" <${config.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
      this.logger.log(`Email sent to ${options.to} (messageId=${info.messageId})`);
      return { sent: true };
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to} for org ${orgId}: ${(error as Error).message}`);
      return { sent: false, reason: 'send-failed' };
    }
  }
}
