import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { LeavesController } from './leaves.controller';
import { LeavesService } from './leaves.service';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';

describe('LeavesController', () => {
  function buildController() {
    const service = {
      findAll: jest.fn(async () => ({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } })),
      findOne: jest.fn(async () => ({ id: 'leave-1', status: 'PENDING' })),
      create: jest.fn(async () => ({ id: 'leave-1', status: 'PENDING' })),
      update: jest.fn(async () => ({ id: 'leave-1', status: 'PENDING' })),
      remove: jest.fn(async () => ({ message: 'Leave deleted successfully' })),
      approve: jest.fn(async () => ({ id: 'leave-1', status: 'APPROVED' })),
      reject: jest.fn(async () => ({ id: 'leave-1', status: 'REJECTED' })),
      cancel: jest.fn(async () => ({ id: 'leave-1', status: 'CANCELLED' })),
      getStats: jest.fn(async () => ({ total: 0, pending: 0, approved: 0, rejected: 0, cancelled: 0 })),
    } as unknown as LeavesService;

    const controller = new LeavesController(service);
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
    it('should call service.findAll with orgId and default query', async () => {
      const { controller, service } = buildController();
      await controller.findAll(makeUser(), {});
      expect(service.findAll).toHaveBeenCalledWith('org-1', {});
    });

    it('should call service.findAll with search and filters', async () => {
      const { controller, service } = buildController();
      const query = { search: 'john', status: 'PENDING' as const, type: 'ANNUAL' as const, page: 2, limit: 10, sortBy: 'startDate' as const, sortOrder: 'desc' as const };
      await controller.findAll(makeUser(), query);
      expect(service.findAll).toHaveBeenCalledWith('org-1', query);
    });

    it('should throw ForbiddenException when user has no organization', async () => {
      const { controller } = buildController();
      await expect(controller.findAll(makeUser({ organizationId: undefined }), {})).rejects.toThrow(ForbiddenException);
    });

    it('should not accept organizationId from request', async () => {
      const { controller, service } = buildController();
      await controller.findAll(makeUser(), {});
      const callArgs = (service.findAll as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe('org-1');
    });
  });

  describe('getStats', () => {
    it('should call service.getStats with orgId', async () => {
      const { controller, service } = buildController();
      await controller.getStats(makeUser());
      expect(service.getStats).toHaveBeenCalledWith('org-1');
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with orgId and leaveId', async () => {
      const { controller, service } = buildController();
      await controller.findOne(makeUser(), 'leave-1' as never);
      expect(service.findOne).toHaveBeenCalledWith('org-1', 'leave-1');
    });
  });

  describe('create', () => {
    it('should call service.create with orgId, userId, and dto', async () => {
      const { controller, service } = buildController();
      const dto = { employeeId: 'emp-1', startDate: '2025-01-01', endDate: '2025-01-05', type: 'ANNUAL' };
      await controller.create(makeUser(), dto as never);
      expect(service.create).toHaveBeenCalledWith('org-1', 'user-1', dto);
    });
  });

  describe('update', () => {
    it('should call service.update with orgId, userId, leaveId, and dto', async () => {
      const { controller, service } = buildController();
      const dto = { status: 'APPROVED' as const };
      await controller.update(makeUser(), 'leave-1' as never, dto as never);
      expect(service.update).toHaveBeenCalledWith('org-1', 'user-1', 'leave-1', dto);
    });
  });

  describe('remove', () => {
    it('should call service.remove with orgId, userId, and leaveId', async () => {
      const { controller, service } = buildController();
      await controller.remove(makeUser(), 'leave-1' as never);
      expect(service.remove).toHaveBeenCalledWith('org-1', 'user-1', 'leave-1');
    });
  });

  describe('approve', () => {
    it('should call service.approve with orgId, userId, and leaveId', async () => {
      const { controller, service } = buildController();
      await controller.approve(makeUser(), 'leave-1' as never);
      expect(service.approve).toHaveBeenCalledWith('org-1', 'user-1', 'leave-1');
    });
  });

  describe('reject', () => {
    it('should call service.reject with orgId, userId, and leaveId', async () => {
      const { controller, service } = buildController();
      await controller.reject(makeUser(), 'leave-1' as never);
      expect(service.reject).toHaveBeenCalledWith('org-1', 'user-1', 'leave-1');
    });
  });

  describe('cancel', () => {
    it('should call service.cancel with orgId, userId, and leaveId', async () => {
      const { controller, service } = buildController();
      await controller.cancel(makeUser(), 'leave-1' as never);
      expect(service.cancel).toHaveBeenCalledWith('org-1', 'user-1', 'leave-1');
    });

    it('should throw ForbiddenException when user has no organization', async () => {
      const { controller } = buildController();
      await expect(controller.cancel(makeUser({ organizationId: undefined }), 'leave-1' as never)).rejects.toThrow(ForbiddenException);
    });

    it('should forward userId from CurrentUser', async () => {
      const { controller, service } = buildController();
      await controller.cancel({ id: 'user-99', email: 'x@x.com', role: 'ADMIN', organizationId: 'org-1' }, 'leave-1' as never);
      expect(service.cancel).toHaveBeenCalledWith('org-1', 'user-99', 'leave-1');
    });
  });

  describe('permission metadata', () => {
    const reflector = new Reflector();

    function getPermissions(handler: (...args: never[]) => unknown): string[] | undefined {
      const metadata = reflector.getAllAndOverride(PERMISSIONS_KEY, [handler]);
      return metadata?.permissions;
    }

    it('GET should require leaves.read', () => {
      const { controller } = buildController();
      expect(getPermissions(controller.findAll)).toEqual(['leaves.read']);
    });

    it('GET /stats should require leaves.read', () => {
      const { controller } = buildController();
      expect(getPermissions(controller.getStats)).toEqual(['leaves.read']);
    });

    it('GET /:id should require leaves.read', () => {
      const { controller } = buildController();
      expect(getPermissions(controller.findOne)).toEqual(['leaves.read']);
    });

    it('POST should require leaves.create', () => {
      const { controller } = buildController();
      expect(getPermissions(controller.create)).toEqual(['leaves.create']);
    });

    it('PATCH should require leaves.update', () => {
      const { controller } = buildController();
      expect(getPermissions(controller.update)).toEqual(['leaves.update']);
    });

    it('DELETE should require leaves.delete', () => {
      const { controller } = buildController();
      expect(getPermissions(controller.remove)).toEqual(['leaves.delete']);
    });

    it('POST /:id/approve should require leaves.approve', () => {
      const { controller } = buildController();
      expect(getPermissions(controller.approve)).toEqual(['leaves.approve']);
    });

    it('POST /:id/reject should require leaves.reject', () => {
      const { controller } = buildController();
      expect(getPermissions(controller.reject)).toEqual(['leaves.reject']);
    });

    it('POST /:id/cancel should require leaves.update', () => {
      const { controller } = buildController();
      expect(getPermissions(controller.cancel)).toEqual(['leaves.update']);
    });

    it('should not reference employees.* permissions', () => {
      const { controller } = buildController();
      const allHandlers = [
        controller.findAll,
        controller.getStats,
        controller.findOne,
        controller.create,
        controller.update,
        controller.remove,
        controller.approve,
        controller.reject,
        controller.cancel,
      ];
      for (const handler of allHandlers) {
        const perms = getPermissions(handler);
        expect(perms?.every((p) => !p.startsWith('employees.'))).toBe(true);
      }
    });
  });

  describe('guard metadata', () => {
    it('preserves the class-level JwtAuthGuard', () => {
      const guards = Reflect.getMetadata('__guards__', LeavesController);
      expect(guards).toBeDefined();
      expect(guards.map((g: () => unknown) => g.name)).toContain('JwtAuthGuard');
    });
  });
});
