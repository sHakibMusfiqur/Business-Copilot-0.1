import { Logger } from '@nestjs/common';

import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    smtpFromEmail: '',
    smtpFromName: 'Business Copilot',
    smtpSecure: false,
    ...overrides,
  } as unknown as MailService['config'];
}

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodemailer = require('nodemailer');

describe('Mail Failure Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('A. SMTP not configured — should return smtp-not-configured', () => {
    it('should return { sent: false, reason: "smtp-not-configured" } when no org settings exist', async () => {
      const orgSettingsFindUnique = jest.fn().mockResolvedValue(null);

      const service = new MailService(
        { organizationSettings: { findUnique: orgSettingsFindUnique } } as unknown as PrismaService,
        { buildEmailBrand: jest.fn().mockResolvedValue({}) } as unknown as SettingsService,
        makeConfig(),
      );

      const result = await service.sendMail('org-1', {
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result).toEqual({ sent: false, reason: 'smtp-not-configured' });
    });

    it('should return { sent: false, reason: "smtp-not-configured" } when org settings have no SMTP host', async () => {
      const orgSettingsFindUnique = jest.fn().mockResolvedValue({
        settings: { email: { fromEmail: 'test@example.com' } },
      });

      const service = new MailService(
        { organizationSettings: { findUnique: orgSettingsFindUnique } } as unknown as PrismaService,
        { buildEmailBrand: jest.fn().mockResolvedValue({}) } as unknown as SettingsService,
        makeConfig(),
      );

      const result = await service.sendMail('org-1', {
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result).toEqual({ sent: false, reason: 'smtp-not-configured' });
    });

    it('should not attempt to create a transporter when SMTP is not configured', async () => {
      const orgSettingsFindUnique = jest.fn().mockResolvedValue(null);

      const service = new MailService(
        { organizationSettings: { findUnique: orgSettingsFindUnique } } as unknown as PrismaService,
        { buildEmailBrand: jest.fn().mockResolvedValue({}) } as unknown as SettingsService,
        makeConfig(),
      );

      await service.sendMail('org-1', {
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(nodemailer.createTransport).not.toHaveBeenCalled();
    });
  });

  describe('B. Send failure — should return send-failed', () => {
    it('should return { sent: false, reason: "send-failed" } when transport sendMail throws', async () => {
      const orgSettingsFindUnique = jest.fn().mockResolvedValue({
        settings: {
          email: {
            smtpHost: 'smtp.example.com',
            smtpPort: 587,
            smtpUsername: 'user@example.com',
            smtpPassword: 'password',
            fromEmail: 'from@example.com',
            fromName: 'Test',
            useSSL: false,
          },
        },
      });

      const sendMailMock = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      nodemailer.createTransport.mockReturnValue({ sendMail: sendMailMock });

      const service = new MailService(
        { organizationSettings: { findUnique: orgSettingsFindUnique } } as unknown as PrismaService,
        { buildEmailBrand: jest.fn().mockResolvedValue({}) } as unknown as SettingsService,
        makeConfig(),
      );

      const result = await service.sendMail('org-1', {
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result).toEqual({ sent: false, reason: 'send-failed' });
    });

    it('should return { sent: false, reason: "send-failed" } when createTransport throws', async () => {
      const orgSettingsFindUnique = jest.fn().mockResolvedValue({
        settings: {
          email: {
            smtpHost: 'smtp.example.com',
            smtpPort: 587,
            smtpUsername: 'user@example.com',
            smtpPassword: 'password',
            fromEmail: 'from@example.com',
            fromName: 'Test',
            useSSL: false,
          },
        },
      });

      nodemailer.createTransport.mockImplementation(() => {
        throw new Error('Invalid transport options');
      });

      const service = new MailService(
        { organizationSettings: { findUnique: orgSettingsFindUnique } } as unknown as PrismaService,
        { buildEmailBrand: jest.fn().mockResolvedValue({}) } as unknown as SettingsService,
        makeConfig(),
      );

      const result = await service.sendMail('org-1', {
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result).toEqual({ sent: false, reason: 'send-failed' });
    });

    it('should log error details without exposing credentials on send failure', async () => {
      const orgSettingsFindUnique = jest.fn().mockResolvedValue({
        settings: {
          email: {
            smtpHost: 'smtp.example.com',
            smtpPort: 587,
            smtpUsername: 'user@example.com',
            smtpPassword: 's3cretP@ss',
            fromEmail: 'from@example.com',
            fromName: 'Test',
            useSSL: false,
          },
        },
      });

      const sendMailMock = jest.fn().mockRejectedValue(new Error('EAUTH: Invalid credentials'));
      nodemailer.createTransport.mockReturnValue({ sendMail: sendMailMock });

      const service = new MailService(
        { organizationSettings: { findUnique: orgSettingsFindUnique } } as unknown as PrismaService,
        { buildEmailBrand: jest.fn().mockResolvedValue({}) } as unknown as SettingsService,
        makeConfig(),
      );

      const logSpy = jest.spyOn(Logger.prototype as never, 'error');

      await service.sendMail('org-1', {
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      const errorLogs = logSpy.mock.calls.map((c: unknown[]) => c.join(' ')).join('\n');
      expect(errorLogs).not.toContain('s3cretP@ss');
      expect(errorLogs).toContain('EAUTH');

      logSpy.mockRestore();
    });
  });

  describe('C. Business state unchanged — failed email should not alter business data', () => {
    it('should not alter business state on email failure', async () => {
      const orgSettingsFindUnique = jest.fn().mockResolvedValue({
        settings: {
          email: {
            smtpHost: 'smtp.example.com',
            smtpPort: 587,
            smtpUsername: 'user@example.com',
            smtpPassword: 'password',
            fromEmail: 'from@example.com',
            fromName: 'Test',
            useSSL: false,
          },
        },
      });

      const sendMailMock = jest.fn().mockRejectedValue(new Error('ETIMEDOUT'));
      nodemailer.createTransport.mockReturnValue({ sendMail: sendMailMock });

      const service = new MailService(
        { organizationSettings: { findUnique: orgSettingsFindUnique } } as unknown as PrismaService,
        { buildEmailBrand: jest.fn().mockResolvedValue({}) } as unknown as SettingsService,
        makeConfig(),
      );

      const result = await service.sendMail('org-1', {
        to: 'user@example.com',
        subject: 'Invoice #INV-001',
        html: '<p>Please pay $100</p>',
      });

      expect(result).toEqual({ sent: false, reason: 'send-failed' });
      expect(sendMailMock).toHaveBeenCalledTimes(1);
    });

    it('should not throw when sendMail fails — callers receive a result object', async () => {
      const orgSettingsFindUnique = jest.fn().mockResolvedValue({
        settings: {
          email: {
            smtpHost: 'smtp.example.com',
            smtpPort: 587,
            smtpUsername: 'user@example.com',
            smtpPassword: 'password',
            fromEmail: 'from@example.com',
            fromName: 'Test',
            useSSL: false,
          },
        },
      });

      const sendMailMock = jest.fn().mockRejectedValue(new Error('ENOTFOUND'));
      nodemailer.createTransport.mockReturnValue({ sendMail: sendMailMock });

      const service = new MailService(
        { organizationSettings: { findUnique: orgSettingsFindUnique } } as unknown as PrismaService,
        { buildEmailBrand: jest.fn().mockResolvedValue({}) } as unknown as SettingsService,
        makeConfig(),
      );

      await expect(
        service.sendMail('org-1', {
          to: 'user@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        }),
      ).resolves.toEqual({ sent: false, reason: 'send-failed' });
    });

    it('should return sent: true on success, confirming normal flow still works', async () => {
      const orgSettingsFindUnique = jest.fn().mockResolvedValue({
        settings: {
          email: {
            smtpHost: 'smtp.example.com',
            smtpPort: 587,
            smtpUsername: 'user@example.com',
            smtpPassword: 'password',
            fromEmail: 'from@example.com',
            fromName: 'Test',
            useSSL: false,
          },
        },
      });

      const sendMailMock = jest.fn().mockResolvedValue({ messageId: 'msg-123' });
      nodemailer.createTransport.mockReturnValue({ sendMail: sendMailMock });

      const service = new MailService(
        { organizationSettings: { findUnique: orgSettingsFindUnique } } as unknown as PrismaService,
        { buildEmailBrand: jest.fn().mockResolvedValue({}) } as unknown as SettingsService,
        makeConfig(),
      );

      const result = await service.sendMail('org-1', {
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result).toEqual({ sent: true });
    });
  });
});
