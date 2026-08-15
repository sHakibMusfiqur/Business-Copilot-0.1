import { ConflictException } from '@nestjs/common';
import { ProvisioningExecutorService } from './provisioning-executor.service';

const emptyConfig = {
  departments: [],
  roles: [],
  chartOfAccounts: [],
  inventoryCategories: [],
  approvalWorkflows: [],
  dashboardWidgets: [],
} as const;

function buildMockTx(overrides: Record<string, unknown> = {}) {
  return {
    organization: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'new-org-1', name: 'Acme Inc' }),
    },
    onboardingSession: {
      update: jest.fn().mockResolvedValue({}),
    },
    subscription: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    permission: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    role: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'role-1' }),
    },
    rolePermission: {
      createMany: jest.fn(),
    },
    userRoleAssignment: {
      create: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
    organizationMember: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    department: {
      create: jest.fn(),
      createMany: jest.fn(),
    },
    organizationSettings: {
      upsert: jest.fn().mockResolvedValue({}),
    },
    ...overrides,
  };
}

describe('ProvisioningExecutorService', () => {
  const service = new ProvisioningExecutorService({} as never);

  it('never reuses another tenant\u2019s organization by name and creates a fresh org for the session', async () => {
    const mockTx = buildMockTx();
    mockTx.organization.findUnique.mockImplementation((query: { where: { id?: string; name?: string; slug?: string } }) => {
      if (query.where.id) return Promise.resolve({ id: query.where.id, name: 'Acme Inc' });
      if (query.where.name) return Promise.resolve({ id: 'org-victim', name: 'Acme Inc' });
      return Promise.resolve(null);
    });

    const session = {
      id: 'session-1',
      orgName: 'Acme Inc',
      organizationId: null,
      selectedModules: [],
    };

    const result = await service.executeCheckpoint(session, emptyConfig as never, 1, mockTx);

    expect(result.success).toBe(true);
    expect(result.result?.org.id).toBe('new-org-1');
    expect(mockTx.organization.create).toHaveBeenCalledTimes(1);
    expect(mockTx.organization.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Acme Inc' }) }),
    );
    expect(session.organizationId).toBe('new-org-1');
    expect(mockTx.onboardingSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { organizationId: 'new-org-1' },
    });
  });

  it('binds the session to its own already-created organization when retrying provisioning', async () => {
    const mockTx = buildMockTx();
    mockTx.organization.findUnique.mockImplementation((query: { where: { id?: string } }) =>
      Promise.resolve(query.where.id ? { id: query.where.id, name: 'Acme Inc' } : null),
    );

    const session = {
      id: 'session-1',
      orgName: 'Acme Inc',
      organizationId: 'org-1',
      selectedModules: [],
    };

    const result = await service.executeCheckpoint(session, emptyConfig as never, 1, mockTx);

    expect(result.success).toBe(true);
    expect(result.result?.org.id).toBe('org-1');
    expect(mockTx.organization.create).not.toHaveBeenCalled();
    expect(mockTx.onboardingSession.update).not.toHaveBeenCalled();
    expect(session.organizationId).toBe('org-1');
  });

  it('rejects provisioning with a conflict when the organization name is already taken', async () => {
    const mockTx = buildMockTx();
    mockTx.organization.create.mockRejectedValue({ code: 'P2002' });

    const session = {
      id: 'session-1',
      orgName: 'Acme Inc',
      organizationId: null,
      selectedModules: [],
    };

    await expect(service.executeCheckpoint(session, emptyConfig as never, 1, mockTx)).rejects.toThrow(
      ConflictException,
    );
  });

  it('does not fall back to a globally-scoped org lookup when resuming without an organizationId', async () => {
    const mockTx = buildMockTx();

    const session = {
      id: 'session-1',
      orgName: 'Acme Inc',
      organizationId: null,
      selectedModules: [],
    };

    const result = await service.executeCheckpoint(session, emptyConfig as never, 2, mockTx);

    expect(result.success).toBe(true);
    expect(result.result).toBeUndefined();
    expect(mockTx.organization.findFirst).not.toHaveBeenCalled();
    expect(mockTx.organization.create).not.toHaveBeenCalled();
  });
});
