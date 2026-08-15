import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { InvitationsService } from './invitations.service';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { ConfigService } from '../config/config.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { MailService } from '../mail/mail.service';
import type { CreateInvitationDto } from './dto/create-invitation.dto';
import type { AcceptInvitationDto } from './dto/accept-invitation.dto';

const ORG_ID = 'org-1';
const INVITER = 'admin-1';
const OWNER_ROLE_ID = 'role-owner';

function toDto(overrides: Record<string, unknown> = {}) {
  return { name: 'New Emp', email: 'emp@x.com', ...overrides };
}

describe('InvitationsService (Owner role authorization)', () => {
  let service: InvitationsService;
  let userFindUnique: jest.Mock;
  let invitationFindFirst: jest.Mock;
  let roleFindMany: jest.Mock;
  let invitationCreate: jest.Mock;
  let assertCanGrantOwnerRole: jest.Mock;

  beforeEach(() => {
    userFindUnique = jest.fn();
    invitationFindFirst = jest.fn();
    roleFindMany = jest.fn();
    invitationCreate = jest.fn();
    assertCanGrantOwnerRole = jest.fn().mockResolvedValue(undefined);

    userFindUnique.mockResolvedValue(null);
    invitationFindFirst.mockResolvedValue(null);
    roleFindMany.mockResolvedValue([]);
    invitationCreate.mockResolvedValue({
      id: 'inv-1',
      organizationId: ORG_ID,
      invitedById: INVITER,
      email: 'emp@x.com',
      name: 'Test Emp',
      departmentId: null,
      designation: null,
      managerId: null,
      roleIds: [],
      tokenExpiresAt: new Date(),
      status: 'PENDING',
    });

    service = new InvitationsService(
      {
        user: { findUnique: userFindUnique },
        invitation: { findFirst: invitationFindFirst, create: invitationCreate },
        role: { findMany: roleFindMany },
      } as unknown as PrismaService,
      { sign: jest.fn().mockReturnValue('signed-token') } as unknown as JwtService,
      { webUrl: 'https://app.test', jwtSecret: 'secret' } as unknown as ConfigService,
      { buildEmailBrand: jest.fn().mockResolvedValue({}) } as unknown as SettingsService,
      { sendOrgEmail: jest.fn().mockResolvedValue({ sent: false }) } as unknown as MailService,
      { record: jest.fn() } as unknown as AuditService,
      { assertCanGrantOwnerRole } as unknown as RbacService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a non-Owner inviter assigning the Owner role and does not create the invitation', async () => {
    roleFindMany.mockResolvedValue([{ id: OWNER_ROLE_ID }]);
    assertCanGrantOwnerRole.mockRejectedValue(
      new ForbiddenException('You do not have permission to assign the Owner role'),
    );

    await expect(service.create(ORG_ID, INVITER, toDto({ roleIds: [OWNER_ROLE_ID] }) as CreateInvitationDto)).rejects.toThrow(ForbiddenException);

    expect(assertCanGrantOwnerRole).toHaveBeenCalledWith(ORG_ID, INVITER, [OWNER_ROLE_ID]);
    expect(invitationCreate).not.toHaveBeenCalled();
  });

  it('allows a non-owner inviter to assign non-Owner roles', async () => {
    assertCanGrantOwnerRole.mockResolvedValue(undefined);
    roleFindMany.mockResolvedValue([{ id: 'role-admin' }]);

    await service.create(ORG_ID, INVITER, toDto({ roleIds: ['role-admin'] }) as CreateInvitationDto);

    expect(assertCanGrantOwnerRole).toHaveBeenCalledWith(ORG_ID, INVITER, ['role-admin']);
    expect(invitationCreate).toHaveBeenCalledTimes(1);
  });
});

describe('InvitationsService (organization status on verify/accept)', () => {
  let service: InvitationsService;
  let invitationFindUnique: jest.Mock;
  let organizationFindUnique: jest.Mock;

  beforeEach(() => {
    invitationFindUnique = jest.fn().mockResolvedValue({
      id: 'inv-1',
      organizationId: ORG_ID,
      email: 'emp@x.com',
      name: 'New Emp',
      departmentId: null,
      designation: null,
      managerId: null,
      roleIds: [],
      tokenExpiresAt: new Date(Date.now() + 3600_000),
      status: 'PENDING',
    });
    organizationFindUnique = jest.fn().mockResolvedValue({
      isActive: true,
      suspendedAt: null,
      deletedAt: null,
    });

    service = new InvitationsService(
      {
        user: { findUnique: jest.fn().mockResolvedValue(null) },
        invitation: { findUnique: invitationFindUnique },
        organization: { findUnique: organizationFindUnique },
      } as unknown as PrismaService,
      {
        sign: jest.fn(),
        verify: jest.fn().mockReturnValue({ sub: 'inv-1', purpose: 'invitation', org: ORG_ID }),
      } as unknown as JwtService,
      { webUrl: 'https://app.test', jwtSecret: 'secret' } as unknown as ConfigService,
      { buildEmailBrand: jest.fn().mockResolvedValue({ companyName: 'Acme' }) } as unknown as SettingsService,
      { sendOrgEmail: jest.fn().mockResolvedValue({ sent: false }) } as unknown as MailService,
      { record: jest.fn() } as unknown as AuditService,
      { assertCanGrantOwnerRole: jest.fn() } as unknown as RbacService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an invitation for an inactive organization', async () => {
    organizationFindUnique.mockResolvedValue({ isActive: false, suspendedAt: null, deletedAt: null });

    await expect(
      service.accept('token', { name: 'New Emp', password: 'secret123' } as AcceptInvitationDto),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an invitation for a suspended organization', async () => {
    organizationFindUnique.mockResolvedValue({
      isActive: true,
      suspendedAt: new Date(),
      deletedAt: null,
    });

    await expect(service.verify('token')).rejects.toThrow(BadRequestException);
  });

  it('rejects an invitation for a deleted organization', async () => {
    organizationFindUnique.mockResolvedValue({
      isActive: true,
      suspendedAt: null,
      deletedAt: new Date(),
    });

    await expect(service.verify('token')).rejects.toThrow(BadRequestException);
  });

  it('allows an invitation for an active organization', async () => {
    await expect(service.verify('token')).resolves.toMatchObject({ valid: true });
  });
});