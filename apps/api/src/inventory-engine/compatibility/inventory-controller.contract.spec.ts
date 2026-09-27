import { ForbiddenException, RequestMethod } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { InventoryController } from '../../inventory/inventory.controller';
import type { InventoryService } from '../../inventory/inventory.service';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

const GUARDS_METADATA = '__guards__';
const PATH_METADATA = 'path';
const METHOD_METADATA = 'method';

type Handler = (...args: never[]) => unknown;

const handlerOf = (method: keyof InventoryController) =>
  InventoryController.prototype[method] as Handler;

const handlerPath = (handler: Handler) => {
  const raw = Reflect.getMetadata(PATH_METADATA, handler) as string | string[] | undefined;
  if (Array.isArray(raw)) {
    return raw[0] ?? '';
  }
  return raw ?? '';
};

const handlerMethod = (handler: Handler) =>
  Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;

const handlerGuards = (handler: Handler) =>
  (Reflect.getMetadata(GUARDS_METADATA, handler) ?? []) as unknown[];

const classGuards = () =>
  (Reflect.getMetadata(GUARDS_METADATA, InventoryController) ?? []) as unknown[];

const permissionsOf = (handler: Handler) => {
  const reflector = new Reflector();
  return reflector.getAllAndOverride<{ permissions: string[] } | undefined>(PERMISSIONS_KEY, [handler])
    ?.permissions;
};

describe('InventoryController — legacy /inventory* authorization contract', () => {
  function buildController() {
    const service = {
      findAll: jest.fn(async () => ({
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      })),
      adjust: jest.fn(async () => ({
        productId: 'prod-1', productName: 'Widget', productSku: 'W-1',
        type: 'OUT', quantity: 1, previousQuantity: 10, newQuantity: 9,
      })),
      getSummary: jest.fn(async () => ({
        totalProducts: 0, totalStockUnits: 0, inventoryValue: 0,
        lowStockCount: 0, outOfStockCount: 0, averageProductValue: 0,
      })),
      getHistory: jest.fn(async () => []),
    } as unknown as InventoryService;

    const controller = new InventoryController(service);
    return { controller, service };
  }

  const makeUser = (overrides: { organizationId?: string } = {}): CurrentUserPayload => ({
    id: 'user-1',
    email: 'user@test.com',
    role: 'ADMIN',
    organizationId: 'org-1',
    ...overrides,
  });

  const noOrgUser = () => makeUser({ organizationId: undefined });

  it('is routed under the legacy /inventory base path', () => {
    expect(Reflect.getMetadata(PATH_METADATA, InventoryController)).toBe('inventory');
  });

  it('keeps the four legacy routes, their HTTP methods, and handler paths', () => {
    expect(handlerPath(handlerOf('findAll'))).toBe('/');
    expect(handlerMethod(handlerOf('findAll'))).toBe(RequestMethod.GET);

    expect(handlerPath(handlerOf('adjust'))).toBe('adjust');
    expect(handlerMethod(handlerOf('adjust'))).toBe(RequestMethod.POST);

    expect(handlerPath(handlerOf('getSummary'))).toBe('summary');
    expect(handlerMethod(handlerOf('getSummary'))).toBe(RequestMethod.GET);

    expect(handlerPath(handlerOf('getHistory'))).toBe(':productId/history');
    expect(handlerMethod(handlerOf('getHistory'))).toBe(RequestMethod.GET);
  });

  it('guards the class with JwtAuthGuard and every route with PermissionGuard', () => {
    expect(classGuards()).toContain(JwtAuthGuard);
    (['findAll', 'adjust', 'getSummary', 'getHistory'] as const).forEach((method) => {
      expect(handlerGuards(handlerOf(method))).toContain(PermissionGuard);
    });
  });

  it('pins the permission keys required by each route', () => {
    expect(permissionsOf(handlerOf('findAll'))).toEqual(['inventory.read']);
    expect(permissionsOf(handlerOf('adjust'))).toEqual(['inventory.adjust']);
    expect(permissionsOf(handlerOf('getSummary'))).toEqual(['inventory.read']);
    expect(permissionsOf(handlerOf('getHistory'))).toEqual(['inventory.read']);
  });

  it('rejects every route for users without an organization', async () => {
    const { controller } = buildController();
    const user = noOrgUser();

    await expect(controller.findAll(user, {} as never)).rejects.toThrow(ForbiddenException);
    await expect(controller.adjust(user, {} as never)).rejects.toThrow(ForbiddenException);
    await expect(controller.getSummary(user)).rejects.toThrow(ForbiddenException);
    await expect(controller.getHistory(user, 'prod-1')).rejects.toThrow(ForbiddenException);
  });

  it('delegates to the legacy service with the caller organization, user id, and payload', async () => {
    const { controller, service } = buildController();
    const user = makeUser();
    const query = { page: 1, limit: 10 };
    const dto = { productId: 'prod-1', type: 'OUT', quantity: 2 };

    await controller.findAll(user, query as never);
    expect(service.findAll).toHaveBeenCalledWith('org-1', query);

    await controller.adjust(user, dto as never);
    expect(service.adjust).toHaveBeenCalledWith('org-1', 'user-1', dto);

    await controller.getSummary(user);
    expect(service.getSummary).toHaveBeenCalledWith('org-1');

    await controller.getHistory(user, 'prod-1');
    expect(service.getHistory).toHaveBeenCalledWith('org-1', 'prod-1');
  });

  it('returns service responses unchanged (no controller-level reshaping)', async () => {
    const { controller, service } = buildController();

    const list = await controller.findAll(makeUser(), {} as never);
    expect(list).toBe(await (service.findAll as jest.Mock).mock.results[0].value);

    const summary = await controller.getSummary(makeUser());
    expect(summary).toBe(await (service.getSummary as jest.Mock).mock.results[0].value);

    const history = await controller.getHistory(makeUser(), 'prod-1');
    expect(history).toBe(await (service.getHistory as jest.Mock).mock.results[0].value);
  });
});
