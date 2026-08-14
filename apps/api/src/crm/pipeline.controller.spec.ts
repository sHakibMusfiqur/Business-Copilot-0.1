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

import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
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

  const pipeline = {
    findAll: jest.fn(async (orgId: string, query: unknown) => ({ orgId, data: [], query })),
    findById: jest.fn(async (orgId: string, id: string) => ({ orgId, id })),
    create: jest.fn(async (orgId: string, userId: string, dto: unknown) => ({ orgId, userId, dto })),
    update: jest.fn(async (orgId: string, userId: string, id: string, dto: unknown) => ({ orgId, userId, id, dto })),
    softDelete: jest.fn(async (orgId: string, userId: string, id: string) => ({ orgId, userId, id })),
  } as unknown as PipelineService;

  const controller = new PipelineController(pipeline, workspaceAccess, enforcer);

  return {
    controller,
    rbacResolve: rbacPermissions.resolveForUser as jest.Mock,
    pipeline,
  };
}

type EndpointSpec = {
  name: string;
  method: keyof PipelineController;
  permissions: string[];
  serviceCall: (ctx: { controller: PipelineController; pipeline: PipelineService }) => Promise<unknown>;
  serviceMock: (ctx: { controller: PipelineController; pipeline: PipelineService }) => jest.Mock;
};

const ENDPOINTS: EndpointSpec[] = [
  {
    name: 'pipelines findAll',
    method: 'findAll',
    permissions: ['crm.read'],
    serviceCall: ({ controller }) => controller.findAll(makeUser(), { page: 1 } as never),
    serviceMock: ({ pipeline }) => pipeline.findAll as jest.Mock,
  },
  {
    name: 'pipelines findById',
    method: 'findById',
    permissions: ['crm.read'],
    serviceCall: ({ controller }) => controller.findById(makeUser(), 'pipeline-1'),
    serviceMock: ({ pipeline }) => pipeline.findById as jest.Mock,
  },
  {
    name: 'pipelines create',
    method: 'create',
    permissions: ['crm.create'],
    serviceCall: ({ controller }) => controller.create(makeUser(), {} as never),
    serviceMock: ({ pipeline }) => pipeline.create as jest.Mock,
  },
  {
    name: 'pipelines update',
    method: 'update',
    permissions: ['crm.update'],
    serviceCall: ({ controller }) => controller.update(makeUser(), 'pipeline-1', {} as never),
    serviceMock: ({ pipeline }) => pipeline.update as jest.Mock,
  },
  {
    name: 'pipelines delete',
    method: 'remove',
    permissions: ['crm.delete'],
    serviceCall: ({ controller }) => controller.remove(makeUser(), 'pipeline-1'),
    serviceMock: ({ pipeline }) => pipeline.softDelete as jest.Mock,
  },
];

describe('PipelineController (additive Business OS enforcement across CRM)', () => {
  it('retains existing @Permissions metadata on every endpoint', () => {
    for (const endpoint of ENDPOINTS) {
      const descriptor = Object.getOwnPropertyDescriptor(PipelineController.prototype, endpoint.method);
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
    expect(ctx.pipeline.findAll).not.toHaveBeenCalled();
  });

  it('organizationId always comes from the authenticated user.organizationId', async () => {
    const ctx = buildController(async () => ['crm.read']);
    await ctx.controller.findAll(makeUser({ organizationId: 'org-42' }), {} as never);
    expect(ctx.pipeline.findAll).toHaveBeenCalledWith('org-42', expect.anything());
  });

  it('missing organizationId still throws the tenant-context ForbiddenException', async () => {
    const ctx = buildController(async () => ['crm.read']);
    await expect(ctx.controller.findAll(makeUser({ organizationId: undefined }), {} as never)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(ctx.controller.findAll(makeUser({ organizationId: undefined }), {} as never)).rejects.toThrow(
      'User does not belong to an organization',
    );
    expect(ctx.pipeline.findAll).not.toHaveBeenCalled();
  });

  it('no caller options can expand access (billing/inventory permissions do not unlock crm)', async () => {
    const ctx = buildController(async () => ['billing.read', 'inventory.read']);
    await expect(ctx.controller.findAll(makeUser(), {} as never)).rejects.toThrow(
      ForbiddenException,
    );
    expect(ctx.pipeline.findAll).not.toHaveBeenCalled();
  });

  it('ADMIN and USER role mappings continue to work for authorized users', async () => {
    const ctx = buildController(async () => ['crm.read']);
    await ctx.controller.findAll(makeUser({ role: 'ADMIN' }), {} as never);
    await ctx.controller.findAll(makeUser({ role: 'USER' }), {} as never);
    expect(ctx.pipeline.findAll).toHaveBeenCalledTimes(2);
  });

  it('preserves the class-level JwtAuthGuard', () => {
    const guards = Reflect.getMetadata('__guards__', PipelineController);
    expect(guards).toBeDefined();
    expect(guards.map((g: () => unknown) => g.name)).toContain('JwtAuthGuard');
  });
});

describe('PipelineController (Nest DI wiring)', () => {
  it('resolves the controller through DI with no manual instantiation of Business OS services', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule, CoreModule, CrmModule],
    }).compile();

    try {
      const controller = moduleRef.get(PipelineController);
      expect(controller).toBeInstanceOf(PipelineController);
    } finally {
      await moduleRef.close();
    }
  });
});