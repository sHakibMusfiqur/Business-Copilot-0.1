import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';

describe('DepartmentsController', () => {
  function buildController() {
    const service = {
      findAll: jest.fn(async () => []),
      findAllPaginated: jest.fn(async () => ({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } })),
      create: jest.fn(async () => ({ id: '1', name: 'Engineering', code: 'ENG', shared: false })),
      update: jest.fn(async () => ({ id: '1', name: 'Updated', code: 'ENG', shared: false })),
      remove: jest.fn(async () => ({ message: 'Department deleted successfully' })),
    } as unknown as DepartmentsService;

    const controller = new DepartmentsController(service);
    return { controller, service };
  }

  function makeUser(overrides: { organizationId?: string } = {}) {
    return { id: 'user-1', email: 'user@test.com', role: 'ADMIN' as const, organizationId: 'org-1', ...overrides };
  }

  it('should be defined', () => {
    const { controller } = buildController();
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should call service.findAll with orgId', async () => {
      const { controller, service } = buildController();
      await controller.findAll(makeUser());
      expect(service.findAll).toHaveBeenCalledWith('org-1');
    });

    it('should throw ForbiddenException when user has no organization', async () => {
      const { controller } = buildController();
      await expect(controller.findAll(makeUser({ organizationId: undefined }))).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findPaginated', () => {
    it('should call service.findAllPaginated with orgId and query', async () => {
      const { controller, service } = buildController();
      const query = { page: 1, limit: 10, search: 'eng', sortBy: 'name', sortOrder: 'asc' as const };
      await controller.findPaginated(makeUser(), query as never);
      expect(service.findAllPaginated).toHaveBeenCalledWith('org-1', query);
    });

    it('should throw ForbiddenException when user has no organization', async () => {
      const { controller } = buildController();
      await expect(
        controller.findPaginated(makeUser({ organizationId: undefined }), {} as never),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return paginated response shape', async () => {
      const { controller, service } = buildController();
      (service.findAllPaginated as jest.Mock).mockResolvedValue({
        data: [{ id: '1', name: 'Engineering', code: 'ENG', shared: false }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });

      const result = await controller.findPaginated(makeUser(), {} as never);
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.meta).toHaveProperty('total');
      expect(result.meta).toHaveProperty('page');
      expect(result.meta).toHaveProperty('limit');
      expect(result.meta).toHaveProperty('totalPages');
    });
  });

  describe('create', () => {
    it('should call service.create with orgId, userId, and dto', async () => {
      const { controller, service } = buildController();
      const dto = { name: 'Engineering', code: 'ENG' };
      await controller.create(makeUser(), dto as never);
      expect(service.create).toHaveBeenCalledWith('org-1', 'user-1', dto);
    });
  });

  describe('update', () => {
    it('should call service.update with orgId, userId, departmentId, and dto', async () => {
      const { controller, service } = buildController();
      const dto = { name: 'Updated' };
      await controller.update(makeUser(), 'dept-1' as never, dto as never);
      expect(service.update).toHaveBeenCalledWith('org-1', 'user-1', 'dept-1', dto);
    });
  });

  describe('remove', () => {
    it('should call service.remove with orgId, userId, and departmentId', async () => {
      const { controller, service } = buildController();
      await controller.remove(makeUser(), 'dept-1' as never);
      expect(service.remove).toHaveBeenCalledWith('org-1', 'user-1', 'dept-1');
    });
  });

  describe('permission metadata', () => {
    const reflector = new Reflector();

    function getPermissions(handler: (...args: never[]) => unknown): string[] | undefined {
      const metadata = reflector.getAllAndOverride(PERMISSIONS_KEY, [handler]);
      return metadata?.permissions;
    }

    it('GET should require departments.read', () => {
      const { controller } = buildController();
      expect(getPermissions(controller.findAll)).toEqual(['departments.read']);
    });

    it('GET /list should require departments.read', () => {
      const { controller } = buildController();
      expect(getPermissions(controller.findPaginated)).toEqual(['departments.read']);
    });

    it('POST should require departments.create', () => {
      const { controller } = buildController();
      expect(getPermissions(controller.create)).toEqual(['departments.create']);
    });

    it('PATCH should require departments.update', () => {
      const { controller } = buildController();
      expect(getPermissions(controller.update)).toEqual(['departments.update']);
    });

    it('DELETE should require departments.delete', () => {
      const { controller } = buildController();
      expect(getPermissions(controller.remove)).toEqual(['departments.delete']);
    });
  });

  describe('guard metadata', () => {
    it('preserves the class-level JwtAuthGuard', () => {
      const guards = Reflect.getMetadata('__guards__', DepartmentsController);
      expect(guards).toBeDefined();
      expect(guards.map((g: () => unknown) => g.name)).toContain('JwtAuthGuard');
    });
  });
});
