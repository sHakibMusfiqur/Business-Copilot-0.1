import { ProvisioningExecutorService } from './provisioning-executor.service';

const emptyConfig = {
  departments: [],
  roles: [],
  chartOfAccounts: [],
  inventoryCategories: [],
  approvalWorkflows: [],
  dashboardWidgets: [],
} as const;

describe('ProvisioningExecutorService', () => {
  it('reuses an existing organization when retrying provisioning', async () => {
    let nameLookupCount = 0;
    const mockTx = {
      organization: {
        findUnique: jest.fn((query: { where: { id?: string; name?: string; slug?: string } }) => {
          if (query.where.id) {
            return Promise.resolve({ id: query.where.id, name: 'Acme Inc' });
          }
          if (query.where.name) {
            nameLookupCount += 1;
            return Promise.resolve(
              nameLookupCount === 1 ? null : { id: 'org-1', name: query.where.name },
            );
          }
          return Promise.resolve(null);
        }),
        create: jest.fn().mockResolvedValue({ id: 'org-1', name: 'Acme Inc' }),
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
    };

    const service = new ProvisioningExecutorService({} as never);
    const session = {
      id: 'session-1',
      orgName: 'Acme Inc',
      organizationId: null,
      selectedModules: [],
    };

    const first = await service.executeCheckpoint(session, emptyConfig as never, 1, mockTx);
    expect(first.success).toBe(true);
    expect(mockTx.organization.create).toHaveBeenCalledTimes(1);

    const secondSession = { ...session };
    const second = await service.executeCheckpoint(secondSession, emptyConfig as never, 1, mockTx);

    expect(second.success).toBe(true);
    expect(mockTx.organization.create).toHaveBeenCalledTimes(1);
    expect(mockTx.onboardingSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { organizationId: 'org-1' },
    });
  });
});