import { Logger } from '@nestjs/common';

import { MailService } from './mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

describe('MailService fallback logging (no token leakage)', () => {
  let service: MailService;
  let orgSettingsFindUnique: jest.Mock;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    orgSettingsFindUnique = jest.fn();
    orgSettingsFindUnique.mockResolvedValue(null); // no org settings => SMTP unconfigured

    service = new MailService(
      { organizationSettings: { findUnique: orgSettingsFindUnique } } as unknown as PrismaService,
      { buildEmailBrand: jest.fn().mockResolvedValue({}) } as unknown as SettingsService,
    );

    logSpy = jest.spyOn(Logger.prototype as never, 'log');
  });

  afterEach(() => {
    logSpy.mockRestore();
    jest.clearAllMocks();
  });

  it('does not log the reset token or full email body when SMTP is unconfigured', async () => {
    const secretToken = 'eyJhbGciOiJIUzI1NiJ9.very.secret.reset.token';
    const bodyWithToken = `Reset your password: https://app.test/reset?token=${secretToken}`;

    const result = await service.sendMail('org-1', {
      to: 'user@example.com',
      subject: 'Reset your password',
      text: bodyWithToken,
      html: `<p>${bodyWithToken}</p>`,
    });

    expect(result).toEqual({ sent: false, reason: 'smtp-not-configured' });

    const logged = logSpy.mock.calls.map((c: unknown[]) => c.join(' ')).join('\n');
    expect(logged).not.toContain(secretToken);
    expect(logged).not.toContain(bodyWithToken);
    expect(logged).toContain('user@example.com');
  });

  it('logs only safe metadata (recipient + subject) not the body', async () => {
    await service.sendMail('org-1', {
      to: 'user@example.com',
      subject: 'Welcome',
      text: 'full private body',
      html: '<p>full private body</p>',
    });

    const logged = logSpy.mock.calls.map((c: unknown[]) => c.join(' ')).join('\n');
    expect(logged).toContain('user@example.com');
    expect(logged).toContain('Welcome');
    expect(logged).not.toContain('full private body');
  });
});

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodemailer = require('nodemailer');

describe('MailService SMTP transport (TLS certificate verification)', () => {
  let orgSettingsFindUnique: jest.Mock;

  beforeEach(() => {
    orgSettingsFindUnique = jest.fn();
    nodemailer.createTransport.mockClear();
    nodemailer.createTransport.mockReturnValue({
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('does not disable TLS certificate verification for STARTTLS connections', async () => {
    orgSettingsFindUnique.mockResolvedValue({
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

    const service = new MailService(
      { organizationSettings: { findUnique: orgSettingsFindUnique } } as unknown as PrismaService,
      { buildEmailBrand: jest.fn().mockResolvedValue({}) } as unknown as SettingsService,
    );

    await service.sendMail('org-1', {
      to: 'recipient@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    });

    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    const options = nodemailer.createTransport.mock.calls[0][0];
    expect(options.tls).toBeUndefined();
    expect(options.secure).toBe(false);
  });

  it('does not disable TLS certificate verification for implicit SSL connections', async () => {
    orgSettingsFindUnique.mockResolvedValue({
      settings: {
        email: {
          smtpHost: 'smtp.example.com',
          smtpPort: 465,
          smtpUsername: 'user@example.com',
          smtpPassword: 'password',
          fromEmail: 'from@example.com',
          fromName: 'Test',
          useSSL: true,
        },
      },
    });

    const service = new MailService(
      { organizationSettings: { findUnique: orgSettingsFindUnique } } as unknown as PrismaService,
      { buildEmailBrand: jest.fn().mockResolvedValue({}) } as unknown as SettingsService,
    );

    await service.sendMail('org-1', {
      to: 'recipient@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    });

    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    const options = nodemailer.createTransport.mock.calls[0][0];
    expect(options.secure).toBe(true);
    expect(options.tls).toBeUndefined();
  });
});