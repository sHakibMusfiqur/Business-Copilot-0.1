import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { ConfigModule } from '../config/config.module';
import { CoreModule } from '../core/core.module';
import { WorkspaceAccessEnforcer } from '../core/workspace-access-enforcer';
import { WorkspaceAccessPolicy } from '../core/workspace-access-policy';
import { BUILTIN_MODULE_MANIFESTS } from '../core/module-manifests';
import { ModuleRegistry } from '../core/module-registry';
import { RbacWorkspacePermissions } from '../core/rbac-workspace-permissions';
import { WorkspaceContextAdapter } from '../core/workspace-context.adapter';
import { WorkspacePermissionMapper } from '../core/workspace-permission.mapper';
import { WorkspaceResolver } from '../core/workspace-resolver';
import { WorkspaceRuntimeService } from '../core/workspace-runtime.service';
import { RedisModule } from '../infrastructure/redis/redis.module';
import { WorkspaceRuntimeAccessService } from '../rbac/workspace-runtime-access.service';

import { LeadController } from './lead.controller';
import { LeadService } from './lead.service';
import { ActivityService } from './activity.service';
import { CrmModule } from './crm.module';

function makeUser(overrides: Partial<CurrentUserPayload> = {}): CurrentUserPayload {
  return {
    id: 'user-1',
    email: 'member@acme.com',
    role: 'MANAGER',
    organizationId: 'org-1',
    ...overrides,
  };
}

function buildRuntime(): WorkspaceRuntimeService {
  const registry = new ModuleRegistry();
  for (const manifest of BUILTIN_MODULE_MANIFESTS) {
    registry.register(manifest);
  }
  return new WorkspaceRuntimeService(
    new WorkspaceContextAdapter(),
    new WorkspaceResolver(),
    registry,
  );
}

function buildController(getter: (orgId: string, userId: string) => Promise<string[]>) {
  const runtime = buildRuntime();
  const registry = new ModuleRegistry();
  for (const manifest of BUILTIN_MODULE_MANIFESTS) {
    registry.register(manifest);
  }
  const rbacPermissions = {
    resolveForUser: jest.fn((orgId: string, userId: string) => getter(orgId, userId)),
  } as unknown as RbacWorkspacePermissions;

  const workspaceAccess = new WorkspaceRuntimeAccessService(
    rbacPermissions,
    runtime,
    new WorkspacePermissionMapper(),
    registry,
  );
  const enforcer = new WorkspaceAccessEnforcer(new WorkspaceAccessPolicy());

  const lead = {
    getSummary: jest.fn(async (orgId: string) => ({ orgId, summary: true })),
    findAll: jest.fn(async (orgId: string, query: unknown) => ({ orgId, data: [], query })),
    findById: jest.fn(async (orgId: string, id: string) => ({ orgId, id })),
    create: jest.fn(async (orgId: string, userId: string, dto: unknown) => ({ orgId, userId, dto })),
    update: jest.fn(async (orgId: string, userId: string, id: string, dto: unknown) => ({ orgId, userId, id, dto })),
    updateStatus: jest.fn(async (orgId: string, userId: string, id: string, status: unknown) => ({ orgId, userId, id, status })),
    assignUser: jest.fn(async (orgId: string, userId: string, id: string, assignedToId: string | null) => ({ orgId, userId, id, assignedToId })),
    softDelete: jest.fn(async (orgId: string, userId: string, id: string) => ({ orgId, userId, id })),
    getTimeline: jest.fn(async (orgId: string, id: string) => ({ orgId, id })),
  } as unknown as LeadService;

  const activity = {
    findAll: jest.fn(async (orgId: string, query: unknown) => ({ orgId, data: [], query })),
    findById: jest.fn(async (orgId: string, id: string) => ({ orgId, id })),
    findByLead: jest.fn(async (orgId: string, id: string, query: unknown) => ({ orgId, id, query })),
    create: jest.fn(async (orgId: string, userId: string, id: string, dto: unknown) => ({ orgId, userId, id, dto })),
    update: jest.fn(async (orgId: string, userId: string, id: string, dto: unknown) => ({ orgId, userId, id, dto })),
    toggleComplete: jest.fn(async (orgId: string, userId: string, id: string) => ({ orgId, userId, id })),
    delete: jest.fn(async (orgId: string, userId: string, id: string) => ({ orgId, userId, id })),
  } as unknown as ActivityService;

  const controller = new LeadController(
    lead,
    activity,
    workspaceAccess,
    enforcer,
  );

  return {
    controller,
    rbacResolve: rbacPermissions.resolveForUser as jest.Mock,
    lead,
    activity,
  };
}

/** Per-endpoint metadata + service-method + args used by the parameterized tests. */
type EndpointSpec = {
  name: string;
  method: keyof LeadController;
  permissions: string[];
  serviceCall: (ctx: { controller: LeadController; lead: LeadService; activity: ActivityService }) => Promise<unknown>;
  serviceMock: (ctx: { controller: LeadController; lead: LeadService; activity: ActivityService }) => jest.Mock;
};

const ENDPOINTS: EndpointSpec[] = [
  {
    name: 'summary',
    method: 'getSummary',
    permissions: ['crm.read', 'crm.activities'],
    serviceCall: ({ controller }) => controller.getSummary(makeUser()),
    serviceMock: ({ lead }) => lead.getSummary as jest.Mock,
  },
  {
    name: 'leads findAll',
    method: 'findAll',
    permissions: ['crm.read'],
    serviceCall: ({ controller }) => controller.findAll(makeUser(), { page: 1 } as never),
    serviceMock: ({ lead }) => lead.findAll as jest.Mock,
  },
  {
    name: 'leads findById',
    method: 'findById',
    permissions: ['crm.read'],
    serviceCall: ({ controller }) => controller.findById(makeUser(), 'lead-1'),
    serviceMock: ({ lead }) => lead.findById as jest.Mock,
  },
  {
    name: 'leads create',
    method: 'create',
    permissions: ['crm.create'],
    serviceCall: ({ controller }) => controller.create(makeUser(), {} as never),
    serviceMock: ({ lead }) => lead.create as jest.Mock,
  },
  {
    name: 'leads update',
    method: 'update',
    permissions: ['crm.update'],
    serviceCall: ({ controller }) => controller.update(makeUser(), 'lead-1', {} as never),
    serviceMock: ({ lead }) => lead.update as jest.Mock,
  },
  {
    name: 'leads status',
    method: 'updateStatus',
    permissions: ['crm.update'],
    serviceCall: ({ controller }) => controller.updateStatus(makeUser(), 'lead-1', 'NEW' as never),
    serviceMock: ({ lead }) => lead.updateStatus as jest.Mock,
  },
  {
    name: 'leads assign',
    method: 'assignUser',
    permissions: ['crm.update'],
    serviceCall: ({ controller }) => controller.assignUser(makeUser(), 'lead-1', 'u9'),
    serviceMock: ({ lead }) => lead.assignUser as jest.Mock,
  },
  {
    name: 'leads delete',
    method: 'remove',
    permissions: ['crm.delete'],
    serviceCall: ({ controller }) => controller.remove(makeUser(), 'lead-1'),
    serviceMock: ({ lead }) => lead.softDelete as jest.Mock,
  },
  {
    name: 'leads timeline',
    method: 'getTimeline',
    permissions: ['crm.read'],
    serviceCall: ({ controller }) => controller.getTimeline(makeUser(), 'lead-1'),
    serviceMock: ({ lead }) => lead.getTimeline as jest.Mock,
  },
  {
    name: 'leads activities list',
    method: 'getActivities',
    permissions: ['crm.read'],
    serviceCall: ({ controller }) => controller.getActivities(makeUser(), 'lead-1', {} as never),
    serviceMock: ({ activity }) => activity.findByLead as jest.Mock,
  },
  {
    name: 'leads activities create',
    method: 'createActivity',
    permissions: ['crm.create'],
    serviceCall: ({ controller }) => controller.createActivity(makeUser(), 'lead-1', {} as never),
    serviceMock: ({ activity }) => activity.create as jest.Mock,
  },
  {
    name: 'activities findAll',
    method: 'findAllActivities',
    permissions: ['crm.read'],
    serviceCall: ({ controller }) => controller.findAllActivities(makeUser(), {} as never),
    serviceMock: ({ activity }) => activity.findAll as jest.Mock,
  },
  {
    name: 'activities findById',
    method: 'findActivityById',
    permissions: ['crm.read'],
    serviceCall: ({ controller }) => controller.findActivityById(makeUser(), 'act-1'),
    serviceMock: ({ activity }) => activity.findById as jest.Mock,
  },
  {
    name: 'activities update',
    method: 'updateActivity',
    permissions: ['crm.update'],
    serviceCall: ({ controller }) => controller.updateActivity(makeUser(), 'act-1', {} as never),
    serviceMock: ({ activity }) => activity.update as jest.Mock,
  },
  {
    name: 'activities toggle',
    method: 'toggleActivity',
    permissions: ['crm.update'],
    serviceCall: ({ controller }) => controller.toggleActivity(makeUser(), 'act-1'),
    serviceMock: ({ activity }) => activity.toggleComplete as jest.Mock,
  },
  {
    name: 'activities delete',
    method: 'deleteActivity',
    permissions: ['crm.delete'],
    serviceCall: ({ controller }) => controller.deleteActivity(makeUser(), 'act-1'),
    serviceMock: ({ activity }) => activity.delete as jest.Mock,
  },
];

describe('LeadController (Phase 1F.4 additive Business OS enforcement across CRM)', () => {
  it('retains existing @Permissions metadata on every endpoint', () => {
    for (const endpoint of ENDPOINTS) {
      const descriptor = Object.getOwnPropertyDescriptor(LeadController.prototype, endpoint.method);
      const handler = descriptor?.value;
      expect(handler).toBeDefined();
      const handlerGuards = Reflect.getMetadata('__guards__', handler);
      expect(handlerGuards.map((g: () => unknown) => g.name)).toContain('PermissionGuard');
      const permissions = Reflect.getMetadata('permissions', handler);
      expect(permissions).toMatchObject({ permissions: endpoint.permissions });
    }
  });

  it.each(ENDPOINTS.map((e) => e.name))(
    'denies %s by Business OS when effective RBAC cannot resolve the crm module',
    async (name) => {
      const endpoint: EndpointSpec = ENDPOINTS.find((e) => e.name === name) as EndpointSpec;
      const ctx = buildController(async () => []);
      await expect(endpoint.serviceCall(ctx)).rejects.toThrow(ForbiddenException);
      expect(endpoint.serviceMock(ctx)).not.toHaveBeenCalled();
      expect(ctx.rbacResolve).toHaveBeenCalledWith('org-1', 'user-1');
    },
  );

  it.each(ENDPOINTS.map((e) => e.name))(
    'reaches the business service for %s when effective RBAC contains crm.read',
    async (name) => {
      const endpoint: EndpointSpec = ENDPOINTS.find((e) => e.name === name) as EndpointSpec;
      const ctx = buildController(async () => ['crm.read']);
      const result = await endpoint.serviceCall(ctx);
      expect(endpoint.serviceMock(ctx)).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
    },
  );

  it.each(ENDPOINTS.map((e) => e.name))(
    'never calls the business service for %s when Business OS module access is denied',
    async (name) => {
      const endpoint: EndpointSpec = ENDPOINTS.find((e) => e.name === name) as EndpointSpec;
      const ctx = buildController(async () => ['inventory.read']);
      await expect(endpoint.serviceCall(ctx)).rejects.toThrow(ForbiddenException);
      expect(endpoint.serviceMock(ctx)).not.toHaveBeenCalled();
    },
  );

  it('ADMIN and USER role names never grant CRM access by themselves', async () => {
    const ctx = buildController(async () => []);
    await expect(ctx.controller.findAll(makeUser({ role: 'ADMIN' }), {} as never)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(ctx.controller.findAll(makeUser({ role: 'USER' }), {} as never)).rejects.toThrow(
      ForbiddenException,
    );
    expect(ctx.lead.findAll).not.toHaveBeenCalled();
  });

  it('organizationId always comes from the authenticated user.organizationId', async () => {
    const ctx = buildController(async () => ['crm.read']);
    await ctx.controller.findAll(makeUser({ organizationId: 'org-42' }), {} as never);
    expect(ctx.lead.findAll).toHaveBeenCalledWith('org-42', expect.anything());
  });

  it('missing organizationId still throws the tenant-context ForbiddenException', async () => {
    const ctx = buildController(async () => ['crm.read']);
    await expect(ctx.controller.findAll(makeUser({ organizationId: undefined }), {} as never)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(ctx.controller.findAll(makeUser({ organizationId: undefined }), {} as never)).rejects.toThrow(
      'User does not belong to an organization',
    );
    expect(ctx.lead.findAll).not.toHaveBeenCalled();
  });

  it('no caller options can expand access (billing/inventory permissions do not unlock crm)', async () => {
    const ctx = buildController(async () => ['billing.read', 'inventory.read']);
    await expect(ctx.controller.findAll(makeUser(), {} as never)).rejects.toThrow(
      ForbiddenException,
    );
    expect(ctx.lead.findAll).not.toHaveBeenCalled();
  });

  it('ADMIN and USER role mappings continue to work for authorized users', async () => {
    const ctx = buildController(async () => ['crm.read']);
    await ctx.controller.findAll(makeUser({ role: 'ADMIN' }), {} as never);
    await ctx.controller.findAll(makeUser({ role: 'USER' }), {} as never);
    expect(ctx.lead.findAll).toHaveBeenCalledTimes(2);
  });

  it('preserves the class-level JwtAuthGuard', () => {
    const guards = Reflect.getMetadata('__guards__', LeadController);
    expect(guards).toBeDefined();
    expect(guards.map((g: () => unknown) => g.name)).toContain('JwtAuthGuard');
  });

  it('does not attach ParseUUIDPipe to any :id/:leadId/:activityId route argument (IDs are cuid())', async () => {
    const handlers = [
      'findById',
      'update',
      'updateStatus',
      'assignUser',
      'remove',
      'getTimeline',
      'createActivity',
      'getActivities',
      'findActivityById',
      'toggleActivity',
      'updateActivity',
      'deleteActivity',
    ] as const;
    const cuidId = 'clxyz1234567890abcdefghijk';
    for (const handler of handlers) {
      const routeArgs = Reflect.getMetadata('__routeArguments__', LeadController, handler);
      expect(routeArgs).toBeDefined();
      const values = Object.values(routeArgs as Record<number, { pipes?: unknown[] }>);
      const pipes = values.flatMap((arg) => arg.pipes ?? []);
      expect(pipes).toHaveLength(0);
    }
    const ctx = buildController(async () => ['crm.read']);
    await ctx.controller.findById(makeUser(), cuidId);
    expect(ctx.lead.findById).toHaveBeenCalledWith('org-1', cuidId);
    await ctx.controller.updateActivity(makeUser(), cuidId, {} as never);
    expect(ctx.activity.update).toHaveBeenCalledWith('org-1', 'user-1', cuidId, expect.anything());
  });
});

describe('LeadController (Nest DI wiring)', () => {
  it('resolves the controller through DI with no manual instantiation of Business OS services', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule, CoreModule, CrmModule],
    }).compile();

    try {
      const controller = moduleRef.get(LeadController);
      expect(controller).toBeInstanceOf(LeadController);
    } finally {
      await moduleRef.close();
    }
  });
});
