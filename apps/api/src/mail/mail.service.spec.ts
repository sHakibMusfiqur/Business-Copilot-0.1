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