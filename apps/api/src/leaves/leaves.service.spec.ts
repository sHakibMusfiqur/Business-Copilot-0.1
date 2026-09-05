import { NotFoundException, BadRequestException } from '@nestjs/common';

import { LeavesService } from './leaves.service';

describe('LeavesService', () => {
  let service: LeavesService;
  let prismaMock: {
    leave: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
    employee: {
      findFirst: jest.Mock;
    };
  };
  let auditMock: { record: jest.Mock };

  beforeEach(() => {
    prismaMock = {
      leave: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      employee: {
        findFirst: jest.fn(),
      },
    };
    auditMock = { record: jest.fn() };
    service = new LeavesService(prismaMock as never, auditMock as never);
  });

  const orgId = 'org-1';
  const actorId = 'user-1';
  const leaveId = 'leave-1';

  describe('findAll', () => {
    it('returns leaves scoped to organization', async () => {
      const leaves = [{ id: leaveId, status: 'PENDING' }];
      prismaMock.leave.findMany.mockResolvedValue(leaves);
      prismaMock.leave.count.mockResolvedValue(1);

      const result = await service.findAll(orgId);

      expect(result.data).toEqual(leaves);
      expect(result.meta.total).toBe(1);
      expect(prismaMock.leave.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employee: { organizationId: orgId },
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns leave when found', async () => {
      const leave = { id: leaveId, status: 'PENDING' };
      prismaMock.leave.findFirst.mockResolvedValue(leave);

      const result = await service.findOne(orgId, leaveId);
      expect(result).toEqual(leave);
    });

    it('throws NotFoundException when not found', async () => {
      prismaMock.leave.findFirst.mockResolvedValue(null);

      await expect(service.findOne(orgId, leaveId)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for cross-org access', async () => {
      prismaMock.leave.findFirst.mockResolvedValue(null);

      await expect(service.findOne('other-org', leaveId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates a leave request for valid employee', async () => {
      prismaMock.employee.findFirst.mockResolvedValue({ id: 'emp-1', firstName: 'John', lastName: 'Doe' });
      prismaMock.leave.create.mockResolvedValue({
        id: leaveId,
        employeeId: 'emp-1',
        status: 'PENDING',
        type: 'ANNUAL',
        startDate: new Date('2026-09-10'),
        endDate: new Date('2026-09-12'),
      });

      const result = await service.create(orgId, actorId, {
        employeeId: 'emp-1',
        startDate: '2026-09-10',
        endDate: '2026-09-12',
      });

      expect(result.status).toBe('PENDING');
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LEAVE_CREATED' }),
      );
    });

    it('throws when employee not in org', async () => {
      prismaMock.employee.findFirst.mockResolvedValue(null);

      await expect(service.create(orgId, actorId, {
        employeeId: 'wrong-emp',
        startDate: '2026-09-10',
        endDate: '2026-09-12',
      })).rejects.toThrow(BadRequestException);
    });

    it('throws when end date before start date', async () => {
      prismaMock.employee.findFirst.mockResolvedValue({ id: 'emp-1' });

      await expect(service.create(orgId, actorId, {
        employeeId: 'emp-1',
        startDate: '2026-09-15',
        endDate: '2026-09-10',
      })).rejects.toThrow(BadRequestException);
    });
  });

  describe('approve', () => {
    it('approves a pending leave', async () => {
      prismaMock.leave.findFirst.mockResolvedValue({ id: leaveId, status: 'PENDING' });
      prismaMock.leave.update.mockResolvedValue({ id: leaveId, status: 'APPROVED' });

      const result = await service.approve(orgId, actorId, leaveId);
      expect(result.status).toBe('APPROVED');
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LEAVE_APPROVED' }),
      );
    });

    it('throws when leave is not pending', async () => {
      prismaMock.leave.findFirst.mockResolvedValue({ id: leaveId, status: 'APPROVED' });

      await expect(service.approve(orgId, actorId, leaveId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('reject', () => {
    it('rejects a pending leave', async () => {
      prismaMock.leave.findFirst.mockResolvedValue({ id: leaveId, status: 'PENDING' });
      prismaMock.leave.update.mockResolvedValue({ id: leaveId, status: 'REJECTED' });

      const result = await service.reject(orgId, actorId, leaveId);
      expect(result.status).toBe('REJECTED');
    });

    it('throws when leave is not pending', async () => {
      prismaMock.leave.findFirst.mockResolvedValue({ id: leaveId, status: 'CANCELLED' });

      await expect(service.reject(orgId, actorId, leaveId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('deletes a pending leave', async () => {
      prismaMock.leave.findFirst.mockResolvedValue({ id: leaveId, status: 'PENDING' });
      prismaMock.leave.delete.mockResolvedValue({});

      await service.remove(orgId, actorId, leaveId);
      expect(prismaMock.leave.delete).toHaveBeenCalledWith({ where: { id: leaveId, employee: { organizationId: orgId } } });
    });

    it('throws when trying to delete approved leave', async () => {
      prismaMock.leave.findFirst.mockResolvedValue({ id: leaveId, status: 'APPROVED' });

      await expect(service.remove(orgId, actorId, leaveId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getStats', () => {
    it('returns leave statistics', async () => {
      prismaMock.leave.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2);

      const result = await service.getStats(orgId);
      expect(result).toEqual({ total: 10, pending: 3, approved: 5, rejected: 2 });
    });
  });
});
