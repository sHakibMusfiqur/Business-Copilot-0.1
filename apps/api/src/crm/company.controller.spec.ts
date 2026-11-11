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

import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
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

  const company = {
    findAll: jest.fn(async (orgId: string, query: unknown) => ({ orgId, data: [], query })),
    findById: jest.fn(async (orgId: string, id: string) => ({ orgId, id })),
    create: jest.fn(async (orgId: string, userId: string, dto: unknown) => ({ orgId, userId, dto })),
    update: jest.fn(async (orgId: string, userId: string, id: string, dto: unknown) => ({ orgId, userId, id, dto })),
    softDelete: jest.fn(async (orgId: string, userId: string, id: string) => ({ orgId, userId, id })),
  } as unknown as CompanyService;

  const controller = new CompanyController(company, workspaceAccess, enforcer);

  return {
    controller,
    rbacResolve: rbacPermissions.resolveForUser as jest.Mock,
    company,
  };
}

type EndpointSpec = {
  name: string;
  method: keyof CompanyController;
  permissions: string[];
  serviceCall: (ctx: { controller: CompanyController; company: CompanyService }) => Promise<unknown>;
  serviceMock: (ctx: { controller: CompanyController; company: CompanyService }) => jest.Mock;
};

const ENDPOINTS: EndpointSpec[] = [
  {
    name: 'companies findAll',
    method: 'findAll',
    permissions: ['crm.read'],
    serviceCall: ({ controller }) => controller.findAll(makeUser(), { page: 1 } as never),
    serviceMock: ({ company }) => company.findAll as jest.Mock,
  },
  {
    name: 'companies findById',
    method: 'findById',
    permissions: ['crm.read'],
    serviceCall: ({ controller }) => controller.findById(makeUser(), 'company-1'),
    serviceMock: ({ company }) => company.findById as jest.Mock,
  },
  {
    name: 'companies create',
    method: 'create',
    permissions: ['crm.create'],
    serviceCall: ({ controller }) => controller.create(makeUser(), {} as never),
    serviceMock: ({ company }) => company.create as jest.Mock,
  },
  {
    name: 'companies update',
    method: 'update',
    permissions: ['crm.update'],
    serviceCall: ({ controller }) => controller.update(makeUser(), 'company-1', {} as never),
    serviceMock: ({ company }) => company.update as jest.Mock,
  },
  {
    name: 'companies delete',
    method: 'remove',
    permissions: ['crm.delete'],
    serviceCall: ({ controller }) => controller.remove(makeUser(), 'company-1'),
    serviceMock: ({ company }) => company.softDelete as jest.Mock,
  },
];

describe('CompanyController (tenant isolation / IDOR enforcement)', () => {
  it('retains existing @Permissions metadata on every endpoint', () => {
    for (const endpoint of ENDPOINTS) {
      const descriptor = Object.getOwnPropertyDescriptor(CompanyController.prototype, endpoint.method);
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
    expect(ctx.company.findAll).not.toHaveBeenCalled();
  });

  it.each(ENDPOINTS.map((e) => e.name))(
    'organizationId for %s always comes from the authenticated user, never from params or body (IDOR)',
    async (name) => {
      const endpoint: EndpointSpec = ENDPOINTS.find((e) => e.name === name) as EndpointSpec;
      const ctx = buildController(async () => ['crm.read', 'crm.create', 'crm.update', 'crm.delete']);
      const mock = endpoint.serviceMock(ctx);
      const callWithOrg42 = async () => {
        switch (endpoint.method) {
          case 'findAll':
            return ctx.controller.findAll(makeUser({ organizationId: 'org-42' }), {} as never);
          case 'findById':
            return ctx.controller.findById(makeUser({ organizationId: 'org-42' }), 'company-1');
          case 'create':
            return ctx.controller.create(makeUser({ organizationId: 'org-42' }), {} as never);
          case 'update':
            return ctx.controller.update(makeUser({ organizationId: 'org-42' }), 'company-1', {} as never);
          case 'remove':
            return ctx.controller.remove(makeUser({ organizationId: 'org-42' }), 'company-1');
        }
      };
      await callWithOrg42();
      expect(mock).toHaveBeenCalledTimes(1);
      expect(mock.mock.calls[0][0]).toBe('org-42');
    },
  );

  it('missing organizationId still throws the tenant-context ForbiddenException', async () => {
    const ctx = buildController(async () => ['crm.read']);
    await expect(ctx.controller.findAll(makeUser({ organizationId: undefined }), {} as never)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(ctx.controller.findAll(makeUser({ organizationId: undefined }), {} as never)).rejects.toThrow(
      'User does not belong to an organization',
    );
    expect(ctx.company.findAll).not.toHaveBeenCalled();
  });

  it('no caller options can expand access (billing/inventory permissions do not unlock crm)', async () => {
    const ctx = buildController(async () => ['billing.read', 'inventory.read']);
    await expect(ctx.controller.findAll(makeUser(), {} as never)).rejects.toThrow(
      ForbiddenException,
    );
    expect(ctx.company.findAll).not.toHaveBeenCalled();
  });

  it('preserves the class-level JwtAuthGuard', () => {
    const guards = Reflect.getMetadata('__guards__', CompanyController);
    expect(guards).toBeDefined();
    expect(guards.map((g: () => unknown) => g.name)).toContain('JwtAuthGuard');
  });
});

describe('CompanyController (Nest DI wiring)', () => {
  it('resolves the controller through DI with no manual instantiation of Business OS services', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule, CoreModule, CrmModule],
    }).compile();

    try {
      const controller = moduleRef.get(CompanyController);
      expect(controller).toBeInstanceOf(CompanyController);
    } finally {
      await moduleRef.close();
    }
  });
});
