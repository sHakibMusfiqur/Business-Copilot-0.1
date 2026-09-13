import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';

describe('DepartmentsController', () => {
  function buildController() {
    const service = {
      findAll: jest.fn(async () => []),
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

    function getPermissions(handler: Function): string[] | undefined {
      const metadata = reflector.getAllAndOverride(PERMISSIONS_KEY, [handler]);
      return metadata?.permissions;
    }

    it('GET should require departments.read', () => {
      const { controller } = buildController();
      expect(getPermissions(controller.findAll)).toEqual(['departments.read']);
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
