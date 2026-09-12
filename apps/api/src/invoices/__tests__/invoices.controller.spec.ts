import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

import { InvoicesController } from '../invoices.controller';
import { InvoicesService } from '../invoices.service';

function makeUser(overrides: Partial<CurrentUserPayload> = {}): CurrentUserPayload {
  return {
    id: 'user-1',
    email: 'member@acme.com',
    role: 'ADMIN',
    organizationId: 'org-1',
    ...overrides,
  };
}

function buildController() {
  const invoicesService = {
    findAll: jest.fn(async (orgId: string, query: unknown) => ({ orgId, data: [], query })),
    findById: jest.fn(async (orgId: string, id: string) => ({ orgId, id })),
    createFromOrder: jest.fn(async (orgId: string, userId: string, salesOrderId: string) => ({
      orgId,
      userId,
      salesOrderId,
    })),
    update: jest.fn(async (orgId: string, userId: string, id: string, dto: unknown) => ({
      orgId,
      userId,
      id,
      dto,
    })),
    remove: jest.fn(async (orgId: string, userId: string, id: string) => ({
      orgId,
      userId,
      id,
    })),
  } as unknown as InvoicesService;

  const controller = new InvoicesController(invoicesService);

  return { controller, invoicesService };
}

type EndpointSpec = {
  name: string;
  method: keyof InvoicesController;
  permissions: string[];
  serviceCall: (ctx: { controller: InvoicesController; invoicesService: InvoicesService }) => Promise<unknown>;
  serviceMock: (ctx: { controller: InvoicesController; invoicesService: InvoicesService }) => jest.Mock;
};

const ENDPOINTS: EndpointSpec[] = [
  {
    name: 'invoices findAll',
    method: 'findAll',
    permissions: ['invoices.read'],
    serviceCall: ({ controller }) => controller.findAll(makeUser(), { page: 1 } as never),
    serviceMock: ({ invoicesService }) => invoicesService.findAll as jest.Mock,
  },
  {
    name: 'invoices findOne',
    method: 'findOne',
    permissions: ['invoices.read'],
    serviceCall: ({ controller }) => controller.findOne(makeUser(), 'inv-1' as never),
    serviceMock: ({ invoicesService }) => invoicesService.findById as jest.Mock,
  },
  {
    name: 'invoices createFromOrder',
    method: 'createFromOrder',
    permissions: ['invoices.create'],
    serviceCall: ({ controller }) => controller.createFromOrder(makeUser(), 'so-1' as never),
    serviceMock: ({ invoicesService }) => invoicesService.createFromOrder as jest.Mock,
  },
  {
    name: 'invoices update',
    method: 'update',
    permissions: ['invoices.update'],
    serviceCall: ({ controller }) => controller.update(makeUser(), 'inv-1' as never, {} as never),
    serviceMock: ({ invoicesService }) => invoicesService.update as jest.Mock,
  },
  {
    name: 'invoices remove',
    method: 'remove',
    permissions: ['invoices.delete'],
    serviceCall: ({ controller }) => controller.remove(makeUser(), 'inv-1' as never),
    serviceMock: ({ invoicesService }) => invoicesService.remove as jest.Mock,
  },
];

describe('InvoicesController', () => {
  it('retains @Permissions metadata on every endpoint', () => {
    for (const endpoint of ENDPOINTS) {
      const descriptor = Object.getOwnPropertyDescriptor(InvoicesController.prototype, endpoint.method);
      const handler = descriptor?.value;
      expect(handler).toBeDefined();
      const permissions = Reflect.getMetadata('permissions', handler);
      expect(permissions).toMatchObject({ permissions: endpoint.permissions });
    }
  });

  it.each(ENDPOINTS.map((e) => e.name))(
    'reaches the service for %s when user has organizationId',
    async (name) => {
      const endpoint = ENDPOINTS.find((e) => e.name === name) as EndpointSpec;
      const ctx = buildController();
      const result = await endpoint.serviceCall(ctx);
      expect(endpoint.serviceMock(ctx)).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
    },
  );

  it.each([
    ['invoices findAll', (c: InvoicesController) => c.findAll(makeUser({ organizationId: undefined }), {} as never)],
    ['invoices findOne', (c: InvoicesController) => c.findOne(makeUser({ organizationId: undefined }), 'inv-1' as never)],
    ['invoices createFromOrder', (c: InvoicesController) => c.createFromOrder(makeUser({ organizationId: undefined }), 'so-1' as never)],
    ['invoices update', (c: InvoicesController) => c.update(makeUser({ organizationId: undefined }), 'inv-1' as never, {} as never)],
    ['invoices remove', (c: InvoicesController) => c.remove(makeUser({ organizationId: undefined }), 'inv-1' as never)],
  ])(
    'denies %s when user has no organizationId',
    async (_name: string, call: (c: InvoicesController) => Promise<unknown>) => {
      const { controller } = buildController();
      try {
        await call(controller);
        fail('Expected ForbiddenException');
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException);
        expect((err as Error).message).toBe('User does not belong to an organization');
      }
    },
  );

  it('organizationId always comes from authenticated user.organizationId', async () => {
    const ctx = buildController();
    await ctx.controller.findAll(makeUser({ organizationId: 'org-42' }), {} as never);
    expect(ctx.invoicesService.findAll).toHaveBeenCalledWith('org-42', expect.anything());
  });

  it('missing organizationId throws ForbiddenException', async () => {
    const ctx = buildController();
    try {
      await ctx.controller.findAll(makeUser({ organizationId: undefined }), {} as never);
      fail('Expected ForbiddenException');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as Error).message).toBe('User does not belong to an organization');
    }
    expect(ctx.invoicesService.findAll).not.toHaveBeenCalled();
  });

  it('preserves the class-level JwtAuthGuard', () => {
    const guards = Reflect.getMetadata('__guards__', InvoicesController);
    expect(guards).toBeDefined();
    expect(guards.map((g: () => unknown) => g.name)).toContain('JwtAuthGuard');
  });

  it('preserves the class-level PermissionGuard', () => {
    const guards = Reflect.getMetadata('__guards__', InvoicesController);
    expect(guards).toBeDefined();
    expect(guards.map((g: () => unknown) => g.name)).toContain('PermissionGuard');
  });

  describe('createFromOrder', () => {
    it('passes userId from authenticated user to service', async () => {
      const ctx = buildController();
      await ctx.controller.createFromOrder(makeUser({ id: 'user-99' }), 'so-1' as never);
      expect(ctx.invoicesService.createFromOrder).toHaveBeenCalledWith('org-1', 'user-99', 'so-1');
    });
  });

  describe('update', () => {
    it('passes userId from authenticated user to service', async () => {
      const ctx = buildController();
      await ctx.controller.update(makeUser({ id: 'user-99' }), 'inv-1' as never, { notes: 'x' } as never);
      expect(ctx.invoicesService.update).toHaveBeenCalledWith('org-1', 'user-99', 'inv-1', { notes: 'x' });
    });
  });

  describe('remove', () => {
    it('passes userId from authenticated user to service', async () => {
      const ctx = buildController();
      await ctx.controller.remove(makeUser({ id: 'user-99' }), 'inv-1' as never);
      expect(ctx.invoicesService.remove).toHaveBeenCalledWith('org-1', 'user-99', 'inv-1');
    });
  });
});
