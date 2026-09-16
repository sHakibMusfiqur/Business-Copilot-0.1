import { OrganizationController } from '../organization.controller';
import { OrganizationService } from '../organization.service';
import type { AuthService } from '../../auth/auth.service';
import type { ConfigService } from '../../config/config.service';

function buildController(orgOverrides: Partial<OrganizationService> = {}) {
  const organizationService = {
    create: jest.fn(),
    findPublicBySlug: jest.fn(),
    findPublicByEmail: jest.fn(),
    findPublicById: jest.fn(),
    ...orgOverrides,
  } as unknown as OrganizationService;

  const authService = {
    generateTokens: jest.fn(),
  } as unknown as AuthService;

  const config = {
    isProduction: false,
  } as unknown as ConfigService;

  const controller = new OrganizationController(
    organizationService,
    authService,
    config,
  );

  return { controller, organizationService };
}

describe('OrganizationController', () => {
  describe('getByEmail (POST /organizations/by-email)', () => {
    it('returns organization data when email belongs to an org', async () => {
      const mockOrg = {
        id: 'org-1',
        slug: 'acme-corp',
        name: 'Acme Corp',
        brand: { primaryColor: '#000000' },
      };

      const { controller, organizationService } = buildController({
        findPublicByEmail: jest.fn().mockResolvedValue(mockOrg),
      });

      const result = await controller.getByEmail({ email: 'user@acme.com' });

      expect(result).toEqual({ organization: mockOrg });
      expect(organizationService.findPublicByEmail).toHaveBeenCalledWith('user@acme.com');
    });

    it('returns placeholder when email has no org (no enumeration)', async () => {
      const { controller, organizationService } = buildController({
        findPublicByEmail: jest.fn().mockResolvedValue(null),
      });

      const result = await controller.getByEmail({ email: 'unknown@example.com' });

      expect(result).toEqual({
        organization: {
          id: 'unknown',
          slug: 'unknown',
          name: '',
          brand: {},
        },
      });
      expect(organizationService.findPublicByEmail).toHaveBeenCalledWith('unknown@example.com');
    });

    it('response shape is identical for known and unknown emails', async () => {
      const mockOrg = {
        id: 'org-1',
        slug: 'acme-corp',
        name: 'Acme Corp',
        brand: { primaryColor: '#000000' },
      };

      const { controller } = buildController({
        findPublicByEmail: jest.fn()
          .mockResolvedValueOnce(mockOrg)
          .mockResolvedValueOnce(null),
      });

      const knownResult = await controller.getByEmail({ email: 'user@acme.com' });
      const unknownResult = await controller.getByEmail({ email: 'nobody@example.com' });

      // Both responses have exactly the same top-level keys
      expect(Object.keys(knownResult)).toEqual(Object.keys(unknownResult));
      // Both have an `organization` field
      expect(knownResult).toHaveProperty('organization');
      expect(unknownResult).toHaveProperty('organization');
      // Neither has a `found` boolean
      expect(knownResult).not.toHaveProperty('found');
      expect(unknownResult).not.toHaveProperty('found');
    });

    it('placeholder organization has no sensitive data', async () => {
      const { controller } = buildController({
        findPublicByEmail: jest.fn().mockResolvedValue(null),
      });

      const result = await controller.getByEmail({ email: 'nobody@example.com' });
      const org = result.organization;

      expect(org.id).toBe('unknown');
      expect(org.slug).toBe('unknown');
      expect(org.name).toBe('');
      expect(org.brand).toEqual({});
    });

    it('does not leak org name or ID for unknown emails', async () => {
      const { controller } = buildController({
        findPublicByEmail: jest.fn().mockResolvedValue(null),
      });

      const result = await controller.getByEmail({ email: 'nobody@example.com' });

      // The placeholder must not contain any real org identifiers
      expect(result.organization.id).not.toMatch(/^[a-z0-9]{20,}$/); // not a cuid
      expect(result.organization.name).toBe('');
    });
  });
});
