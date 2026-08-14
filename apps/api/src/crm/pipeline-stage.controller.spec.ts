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

import { PipelineStageController } from './pipeline-stage.controller';
import { PipelineStageService } from './pipeline-stage.service';
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

  const stage = {
    findByPipeline: jest.fn(async (orgId: string, pipelineId: string) => ({ orgId, pipelineId })),
    findById: jest.fn(async (orgId: string, id: string) => ({ orgId, id })),
    create: jest.fn(async (orgId: string, userId: string, pipelineId: string, dto: unknown) => ({ orgId, userId, pipelineId, dto })),
    update: jest.fn(async (orgId: string, userId: string, id: string, dto: unknown) => ({ orgId, userId, id, dto })),
    softDelete: jest.fn(async (orgId: string, userId: string, id: string) => ({ orgId, userId, id })),
  } as unknown as PipelineStageService;

  const controller = new PipelineStageController(stage, workspaceAccess, enforcer);

  return {
    controller,
    rbacResolve: rbacPermissions.resolveForUser as jest.Mock,
    stage,
  };
}

type EndpointSpec = {
  name: string;
  method: keyof PipelineStageController;
  permissions: string[];
  serviceCall: (ctx: { controller: PipelineStageController; stage: PipelineStageService }) => Promise<unknown>;
  serviceMock: (ctx: { controller: PipelineStageController; stage: PipelineStageService }) => jest.Mock;
};

const ENDPOINTS: EndpointSpec[] = [
  {
    name: 'stages findByPipeline',
    method: 'findByPipeline',
    permissions: ['crm.read'],
    serviceCall: ({ controller }) => controller.findByPipeline(makeUser(), 'pipeline-1'),
    serviceMock: ({ stage }) => stage.findByPipeline as jest.Mock,
  },
  {
    name: 'stages findById',
    method: 'findById',
    permissions: ['crm.read'],
    serviceCall: ({ controller }) => controller.findById(makeUser(), 'stage-1'),
    serviceMock: ({ stage }) => stage.findById as jest.Mock,
  },
  {
    name: 'stages create',
    method: 'create',
    permissions: ['crm.create'],
    serviceCall: ({ controller }) => controller.create(makeUser(), 'pipeline-1', {} as never),
    serviceMock: ({ stage }) => stage.create as jest.Mock,
  },
  {
    name: 'stages update',
    method: 'update',
    permissions: ['crm.update'],
    serviceCall: ({ controller }) => controller.update(makeUser(), 'stage-1', {} as never),
    serviceMock: ({ stage }) => stage.update as jest.Mock,
  },
  {
    name: 'stages delete',
    method: 'remove',
    permissions: ['crm.delete'],
    serviceCall: ({ controller }) => controller.remove(makeUser(), 'stage-1'),
    serviceMock: ({ stage }) => stage.softDelete as jest.Mock,
  },
];

describe('PipelineStageController (additive Business OS enforcement across CRM)', () => {
  it('retains existing @Permissions metadata on every endpoint', () => {
    for (const endpoint of ENDPOINTS) {
      const descriptor = Object.getOwnPropertyDescriptor(PipelineStageController.prototype, endpoint.method);
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
    await expect(ctx.controller.findById(makeUser({ role: 'ADMIN' }), 'stage-1')).rejects.toThrow(
      ForbiddenException,
    );
    await expect(ctx.controller.findById(makeUser({ role: 'USER' }), 'stage-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(ctx.stage.findById).not.toHaveBeenCalled();
  });

  it('organizationId always comes from the authenticated user.organizationId', async () => {
    const ctx = buildController(async () => ['crm.read']);
    await ctx.controller.findById(makeUser({ organizationId: 'org-42' }), 'stage-1');
    expect(ctx.stage.findById).toHaveBeenCalledWith('org-42', 'stage-1');
  });

  it('missing organizationId still throws the tenant-context ForbiddenException', async () => {
    const ctx = buildController(async () => ['crm.read']);
    await expect(ctx.controller.findById(makeUser({ organizationId: undefined }), 'stage-1')).rejects.toThrow(
      ForbiddenException,
    );
    await expect(ctx.controller.findById(makeUser({ organizationId: undefined }), 'stage-1')).rejects.toThrow(
      'User does not belong to an organization',
    );
    expect(ctx.stage.findById).not.toHaveBeenCalled();
  });

  it('no caller options can expand access (billing/inventory permissions do not unlock crm)', async () => {
    const ctx = buildController(async () => ['billing.read', 'inventory.read']);
    await expect(ctx.controller.findById(makeUser(), 'stage-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(ctx.stage.findById).not.toHaveBeenCalled();
  });

  it('ADMIN and USER role mappings continue to work for authorized users', async () => {
    const ctx = buildController(async () => ['crm.read']);
    await ctx.controller.findById(makeUser({ role: 'ADMIN' }), 'stage-1');
    await ctx.controller.findById(makeUser({ role: 'USER' }), 'stage-1');
    expect(ctx.stage.findById).toHaveBeenCalledTimes(2);
  });

  it('preserves the class-level JwtAuthGuard', () => {
    const guards = Reflect.getMetadata('__guards__', PipelineStageController);
    expect(guards).toBeDefined();
    expect(guards.map((g: () => unknown) => g.name)).toContain('JwtAuthGuard');
  });
});

describe('PipelineStageController (Nest DI wiring)', () => {
  it('resolves the controller through DI with no manual instantiation of Business OS services', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule, CoreModule, CrmModule],
    }).compile();

    try {
      const controller = moduleRef.get(PipelineStageController);
      expect(controller).toBeInstanceOf(PipelineStageController);
    } finally {
      await moduleRef.close();
    }
  });
});