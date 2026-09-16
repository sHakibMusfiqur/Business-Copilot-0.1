import { AuthController } from '../auth.controller';
import type { AuthService } from '../auth.service';
import type { ConfigService } from '../../config/config.service';
import type { MailService } from '../../mail/mail.service';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

function makeUser(overrides: Partial<CurrentUserPayload> = {}): CurrentUserPayload {
  return {
    id: 'user-1',
    email: 'admin@acme.com',
    role: 'ADMIN',
    organizationId: 'org-1',
    ...overrides,
  };
}

function buildController(overrides: { mailService?: Partial<MailService> } = {}) {
  const authService = {} as unknown as AuthService;
  const config = {} as unknown as ConfigService;
  const mailService = {
    verifyTransporter: jest.fn(),
    ...overrides.mailService,
  } as unknown as MailService;

  const controller = new AuthController(authService, config, mailService);
  return { controller, mailService };
}

describe('AuthController', () => {
  describe('smtpDiagnostic (GET /auth/smtp-diagnostic)', () => {
    it('calls mailService.verifyTransporter with the user organization ID', async () => {
      const mockDiagnostic = {
        host: 'smtp.example.com',
        port: 587,
        secure: true,
        usernamePresent: true,
        passwordPresent: true,
        configured: true,
        verifySuccess: true,
      };
      const { controller, mailService } = buildController({
        mailService: { verifyTransporter: jest.fn().mockResolvedValue(mockDiagnostic) },
      });

      const result = await controller.smtpDiagnostic(makeUser());

      expect(mailService.verifyTransporter).toHaveBeenCalledWith('org-1');
      expect(result).toEqual(mockDiagnostic);
    });

    it('passes empty string when user has no organization', async () => {
      const { controller, mailService } = buildController({
        mailService: { verifyTransporter: jest.fn().mockResolvedValue({ configured: false }) },
      });

      await controller.smtpDiagnostic(makeUser({ organizationId: undefined }));

      expect(mailService.verifyTransporter).toHaveBeenCalledWith('');
    });

    it('returns diagnostic without exposing SMTP credentials', async () => {
      const { controller } = buildController({
        mailService: {
          verifyTransporter: jest.fn().mockResolvedValue({
            host: 'smtp.example.com',
            port: 587,
            secure: true,
            usernamePresent: true,
            passwordPresent: true,
            configured: true,
            verifySuccess: true,
          }),
        },
      });

      const result = await controller.smtpDiagnostic(makeUser());

      // The result must NOT contain actual username or password values
      expect(result).not.toHaveProperty('username');
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('pass');
      expect(result).not.toHaveProperty('user');
      // Only boolean flags should be present
      expect(result).toHaveProperty('usernamePresent');
      expect(result).toHaveProperty('passwordPresent');
      expect(typeof result.usernamePresent).toBe('boolean');
      expect(typeof result.passwordPresent).toBe('boolean');
    });

    it('returns diagnostic with safe metadata fields only', async () => {
      const { controller } = buildController({
        mailService: {
          verifyTransporter: jest.fn().mockResolvedValue({
            host: 'smtp.example.com',
            port: 587,
            secure: true,
            usernamePresent: true,
            passwordPresent: true,
            configured: true,
            verifySuccess: false,
            errorCode: 'AUTH',
            responseCode: 535,
            command: 'AUTH LOGIN',
            errorMessage: 'Authentication failed',
          }),
        },
      });

      const result = await controller.smtpDiagnostic(makeUser());

      // Safe fields are returned
      expect(result).toHaveProperty('host');
      expect(result).toHaveProperty('port');
      expect(result).toHaveProperty('secure');
      expect(result).toHaveProperty('configured');
      expect(result).toHaveProperty('verifySuccess');
      expect(result).toHaveProperty('errorCode');
      expect(result).toHaveProperty('responseCode');
      expect(result).toHaveProperty('command');
      expect(result).toHaveProperty('errorMessage');
    });

    it('does not expose the organization ID in the response', async () => {
      const { controller } = buildController({
        mailService: {
          verifyTransporter: jest.fn().mockResolvedValue({ configured: false }),
        },
      });

      const result = await controller.smtpDiagnostic(makeUser({ organizationId: 'org-secret-123' }));

      const resultStr = JSON.stringify(result);
      expect(resultStr).not.toContain('org-secret-123');
    });
  });
});
