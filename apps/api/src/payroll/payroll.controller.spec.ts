import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';

describe('PayrollController', () => {
  function buildController() {
    const service = {
      findAll: jest.fn(async () => ({ data: [], meta: { total: 0, page: 1, limit: 50, totalPages: 0 } })),
      findOne: jest.fn(async () => ({ id: 'payroll-1', netSalary: 5000 })),
      create: jest.fn(async () => ({ id: 'payroll-1', netSalary: 5000 })),
      update: jest.fn(async () => ({ id: 'payroll-1', netSalary: 6000 })),
      remove: jest.fn(async () => ({ message: 'Payroll record deleted successfully' })),
      getStats: jest.fn(async () => ({ total: 0, totalNetSalary: 0, totalBasicSalary: 0, totalAllowances: 0, totalDeductions: 0, totalTax: 0, byMonth: [] })),
    } as unknown as PayrollService;

    const controller = new PayrollController(service);
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
    it('should call service.findAll with orgId and empty query', async () => {
      const { controller, service } = buildController();
      await controller.findAll(makeUser(), {} as never);
      expect(service.findAll).toHaveBeenCalledWith('org-1', {});
    });

    it('should call service.findAll with query params', async () => {
      const { controller, service } = buildController();
      await controller.findAll(makeUser(), {
        search: 'john',
        employeeId: 'emp-1',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        sortBy: 'basicSalary',
        sortOrder: 'asc',
        page: 2,
        limit: 10,
      } as never);
      expect(service.findAll).toHaveBeenCalledWith('org-1', {
        search: 'john',
        employeeId: 'emp-1',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        sortBy: 'basicSalary',
        sortOrder: 'asc',
        page: 2,
        limit: 10,
      });
    });

    it('should throw ForbiddenException when user has no organization', async () => {
      const { controller } = buildController();
      await expect(controller.findAll(makeUser({ organizationId: undefined }), {} as never)).rejects.toThrow(ForbiddenException);
    });

    it('should not accept organizationId from request', async () => {
      const { controller, service } = buildController();
      await controller.findAll(makeUser(), {} as never);
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

    it('should throw ForbiddenException when user has no organization', async () => {
      const { controller } = buildController();
      await expect(controller.getStats(makeUser({ organizationId: undefined }))).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with orgId and payrollId', async () => {
      const { controller, service } = buildController();
      await controller.findOne(makeUser(), 'payroll-1' as never);
      expect(service.findOne).toHaveBeenCalledWith('org-1', 'payroll-1');
    });

    it('should throw ForbiddenException when user has no organization', async () => {
      const { controller } = buildController();
      await expect(controller.findOne(makeUser({ organizationId: undefined }), 'payroll-1' as never)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create', () => {
    it('should call service.create with orgId, userId, and dto', async () => {
      const { controller, service } = buildController();
      const dto = { employeeId: 'emp-1', periodStart: '2026-01-01', periodEnd: '2026-01-31', basicSalary: 5000 };
      await controller.create(makeUser(), dto as never);
      expect(service.create).toHaveBeenCalledWith('org-1', 'user-1', dto);
    });

    it('should throw ForbiddenException when user has no organization', async () => {
      const { controller } = buildController();
      const dto = { employeeId: 'emp-1', periodStart: '2026-01-01', periodEnd: '2026-01-31', basicSalary: 5000 };
      await expect(controller.create(makeUser({ organizationId: undefined }), dto as never)).rejects.toThrow(ForbiddenException);
    });

    it('should forward userId from CurrentUser', async () => {
      const { controller, service } = buildController();
      const dto = { employeeId: 'emp-1', periodStart: '2026-01-01', periodEnd: '2026-01-31', basicSalary: 5000 };
      await controller.create({ id: 'user-99', email: 'x@x.com', role: 'ADMIN', organizationId: 'org-1' }, dto as never);
      expect(service.create).toHaveBeenCalledWith('org-1', 'user-99', dto);
    });
  });

  describe('update', () => {
    it('should call service.update with orgId, userId, payrollId, and dto', async () => {
      const { controller, service } = buildController();
      const dto = { basicSalary: 6000 };
      await controller.update(makeUser(), 'payroll-1' as never, dto as never);
      expect(service.update).toHaveBeenCalledWith('org-1', 'user-1', 'payroll-1', dto);
    });

    it('should throw ForbiddenException when user has no organization', async () => {
      const { controller } = buildController();
      await expect(controller.update(makeUser({ organizationId: undefined }), 'payroll-1' as never, { basicSalary: 6000 } as never)).rejects.toThrow(ForbiddenException);
    });

    it('should forward userId from CurrentUser', async () => {
      const { controller, service } = buildController();
      await controller.update({ id: 'user-99', email: 'x@x.com', role: 'ADMIN', organizationId: 'org-1' }, 'payroll-1' as never, { basicSalary: 6000 } as never);
      expect(service.update).toHaveBeenCalledWith('org-1', 'user-99', 'payroll-1', { basicSalary: 6000 });
    });
  });

  describe('remove', () => {
    it('should call service.remove with orgId, userId, and payrollId', async () => {
      const { controller, service } = buildController();
      await controller.remove(makeUser(), 'payroll-1' as never);
      expect(service.remove).toHaveBeenCalledWith('org-1', 'user-1', 'payroll-1');
    });

    it('should throw ForbiddenException when user has no organization', async () => {
      const { controller } = buildController();
      await expect(controller.remove(makeUser({ organizationId: undefined }), 'payroll-1' as never)).rejects.toThrow(ForbiddenException);
    });

    it('should forward userId from CurrentUser', async () => {
      const { controller, service } = buildController();
      await controller.remove({ id: 'user-99', email: 'x@x.com', role: 'ADMIN', organizationId: 'org-1' }, 'payroll-1' as never);
      expect(service.remove).toHaveBeenCalledWith('org-1', 'user-99', 'payroll-1');
    });
  });

  describe('permission metadata', () => {
    const reflector = new Reflector();

    function getPermissions(handler: (...args: never[]) => unknown): string[] | undefined {
      const metadata = reflector.getAllAndOverride(PERMISSIONS_KEY, [handler]);
      return metadata?.permissions;
    }

    it('GET should require payroll.read', () => {
      const { controller } = buildController();
      expect(getPermissions(controller.findAll)).toEqual(['payroll.read']);
    });

    it('GET /stats should require payroll.read', () => {
      const { controller } = buildController();
      expect(getPermissions(controller.getStats)).toEqual(['payroll.read']);
    });

    it('GET /:id should require payroll.read', () => {
      const { controller } = buildController();
      expect(getPermissions(controller.findOne)).toEqual(['payroll.read']);
    });

    it('POST should require payroll.create', () => {
      const { controller } = buildController();
      expect(getPermissions(controller.create)).toEqual(['payroll.create']);
    });

    it('PATCH should require payroll.update', () => {
      const { controller } = buildController();
      expect(getPermissions(controller.update)).toEqual(['payroll.update']);
    });

    it('DELETE should require payroll.delete', () => {
      const { controller } = buildController();
      expect(getPermissions(controller.remove)).toEqual(['payroll.delete']);
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
      ];
      for (const handler of allHandlers) {
        const perms = getPermissions(handler);
        expect(perms?.every((p) => !p.startsWith('employees.'))).toBe(true);
      }
    });
  });

  describe('guard metadata', () => {
    it('preserves the class-level JwtAuthGuard', () => {
      const guards = Reflect.getMetadata('__guards__', PayrollController);
      expect(guards).toBeDefined();
      expect(guards.map((g: () => unknown) => g.name)).toContain('JwtAuthGuard');
    });
  });
});
