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
    it('returns leaves scoped to organization with default pagination', async () => {
      const leaves = [{ id: leaveId, status: 'PENDING' }];
      prismaMock.leave.findMany.mockResolvedValue(leaves);
      prismaMock.leave.count.mockResolvedValue(1);

      const result = await service.findAll(orgId);

      expect(result.data).toEqual(leaves);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
      expect(prismaMock.leave.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { employee: { organizationId: orgId } },
            ]),
          }),
          orderBy: { createdAt: 'desc' },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('applies search across employee fields with AND tenant scope', async () => {
      prismaMock.leave.findMany.mockResolvedValue([]);
      prismaMock.leave.count.mockResolvedValue(0);

      await service.findAll(orgId, { search: 'john' });

      const findManyCall = prismaMock.leave.findMany.mock.calls[0][0];
      const where = findManyCall.where;
      expect(where.AND).toEqual(
        expect.arrayContaining([
          { employee: { organizationId: orgId } },
          {
            OR: [
              { employee: { firstName: { contains: 'john', mode: 'insensitive' } } },
              { employee: { lastName: { contains: 'john', mode: 'insensitive' } } },
              { employee: { email: { contains: 'john', mode: 'insensitive' } } },
              { employee: { employeeCode: { contains: 'john', mode: 'insensitive' } } },
            ],
          },
        ]),
      );
    });

    it('applies status filter with tenant scope', async () => {
      prismaMock.leave.findMany.mockResolvedValue([]);
      prismaMock.leave.count.mockResolvedValue(0);

      await service.findAll(orgId, { status: 'APPROVED' });

      const findManyCall = prismaMock.leave.findMany.mock.calls[0][0];
      expect(findManyCall.where.AND).toEqual(
        expect.arrayContaining([
          { employee: { organizationId: orgId } },
          { status: 'APPROVED' },
        ]),
      );
    });

    it('applies type filter with tenant scope', async () => {
      prismaMock.leave.findMany.mockResolvedValue([]);
      prismaMock.leave.count.mockResolvedValue(0);

      await service.findAll(orgId, { type: 'SICK' });

      const findManyCall = prismaMock.leave.findMany.mock.calls[0][0];
      expect(findManyCall.where.AND).toEqual(
        expect.arrayContaining([
          { employee: { organizationId: orgId } },
          { type: 'SICK' },
        ]),
      );
    });

    it('applies employeeId filter with tenant scope', async () => {
      prismaMock.leave.findMany.mockResolvedValue([]);
      prismaMock.leave.count.mockResolvedValue(0);

      await service.findAll(orgId, { employeeId: 'emp-1' });

      const findManyCall = prismaMock.leave.findMany.mock.calls[0][0];
      expect(findManyCall.where.AND).toEqual(
        expect.arrayContaining([
          { employee: { organizationId: orgId } },
          { employeeId: 'emp-1' },
        ]),
      );
    });

    it('combines search + status + pagination', async () => {
      prismaMock.leave.findMany.mockResolvedValue([]);
      prismaMock.leave.count.mockResolvedValue(0);

      await service.findAll(orgId, { search: 'doe', status: 'PENDING', page: 2, limit: 10 });

      const findManyCall = prismaMock.leave.findMany.mock.calls[0][0];
      expect(findManyCall.where.AND).toEqual(
        expect.arrayContaining([
          { employee: { organizationId: orgId } },
          { status: 'PENDING' },
          expect.objectContaining({ OR: expect.any(Array) }),
        ]),
      );
      expect(findManyCall.skip).toBe(10);
      expect(findManyCall.take).toBe(10);
    });

    it('uses custom sort field and order', async () => {
      prismaMock.leave.findMany.mockResolvedValue([]);
      prismaMock.leave.count.mockResolvedValue(0);

      await service.findAll(orgId, { sortBy: 'startDate', sortOrder: 'asc' });

      const findManyCall = prismaMock.leave.findMany.mock.calls[0][0];
      expect(findManyCall.orderBy).toEqual({ startDate: 'asc' });
    });

    it('cannot leak cross-tenant data', async () => {
      prismaMock.leave.findMany.mockResolvedValue([]);
      prismaMock.leave.count.mockResolvedValue(0);

      await service.findAll('other-org', { search: 'test' });

      const findManyCall = prismaMock.leave.findMany.mock.calls[0][0];
      expect(findManyCall.where.AND).toEqual(
        expect.arrayContaining([
          { employee: { organizationId: 'other-org' } },
        ]),
      );
    });

    it('defaults page to 1 and limit to 20', async () => {
      prismaMock.leave.findMany.mockResolvedValue([]);
      prismaMock.leave.count.mockResolvedValue(0);

      await service.findAll(orgId, {});

      const findManyCall = prismaMock.leave.findMany.mock.calls[0][0];
      expect(findManyCall.skip).toBe(0);
      expect(findManyCall.take).toBe(20);
    });

    it('caps limit at 100', async () => {
      prismaMock.leave.findMany.mockResolvedValue([]);
      prismaMock.leave.count.mockResolvedValue(0);

      await service.findAll(orgId, { limit: 200 });

      const findManyCall = prismaMock.leave.findMany.mock.calls[0][0];
      expect(findManyCall.take).toBe(100);
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

  describe('cancel', () => {
    it('cancels a pending leave', async () => {
      prismaMock.leave.findFirst.mockResolvedValue({ id: leaveId, status: 'PENDING' });
      prismaMock.leave.update.mockResolvedValue({ id: leaveId, status: 'CANCELLED' });

      const result = await service.cancel(orgId, actorId, leaveId);
      expect(result.status).toBe('CANCELLED');
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LEAVE_CANCELLED' }),
      );
    });

    it('cancels an approved leave', async () => {
      prismaMock.leave.findFirst.mockResolvedValue({ id: leaveId, status: 'APPROVED' });
      prismaMock.leave.update.mockResolvedValue({ id: leaveId, status: 'CANCELLED' });

      const result = await service.cancel(orgId, actorId, leaveId);
      expect(result.status).toBe('CANCELLED');
    });

    it('throws when leave is rejected', async () => {
      prismaMock.leave.findFirst.mockResolvedValue({ id: leaveId, status: 'REJECTED' });

      await expect(service.cancel(orgId, actorId, leaveId)).rejects.toThrow(BadRequestException);
    });

    it('throws when leave is already cancelled', async () => {
      prismaMock.leave.findFirst.mockResolvedValue({ id: leaveId, status: 'CANCELLED' });

      await expect(service.cancel(orgId, actorId, leaveId)).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for cross-tenant leave', async () => {
      prismaMock.leave.findFirst.mockResolvedValue(null);

      await expect(service.cancel('wrong-org', actorId, leaveId)).rejects.toThrow(NotFoundException);
    });

    it('does not set approvedBy when cancelling', async () => {
      prismaMock.leave.findFirst.mockResolvedValue({ id: leaveId, status: 'PENDING' });
      prismaMock.leave.update.mockResolvedValue({ id: leaveId, status: 'CANCELLED' });

      await service.cancel(orgId, actorId, leaveId);

      const updateCall = prismaMock.leave.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('approvedBy');
    });

    it('preserves existing approvedBy when cancelling approved leave', async () => {
      prismaMock.leave.findFirst.mockResolvedValue({ id: leaveId, status: 'APPROVED' });
      prismaMock.leave.update.mockResolvedValue({ id: leaveId, status: 'CANCELLED' });

      await service.cancel(orgId, actorId, leaveId);

      const updateCall = prismaMock.leave.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('approvedBy');
    });

    it('records audit event with previous and new status', async () => {
      prismaMock.leave.findFirst.mockResolvedValue({ id: leaveId, status: 'APPROVED' });
      prismaMock.leave.update.mockResolvedValue({ id: leaveId, status: 'CANCELLED' });

      await service.cancel(orgId, actorId, leaveId);

      expect(auditMock.record).toHaveBeenCalledWith({
        userId: actorId,
        organizationId: orgId,
        action: 'LEAVE_CANCELLED',
        entity: 'Leave',
        entityId: leaveId,
        status: 'SUCCESS',
        metadata: { previousStatus: 'APPROVED', newStatus: 'CANCELLED' },
      });
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

    it('throws when trying to delete rejected leave', async () => {
      prismaMock.leave.findFirst.mockResolvedValue({ id: leaveId, status: 'REJECTED' });

      await expect(service.remove(orgId, actorId, leaveId)).rejects.toThrow(BadRequestException);
    });

    it('throws when trying to delete cancelled leave', async () => {
      prismaMock.leave.findFirst.mockResolvedValue({ id: leaveId, status: 'CANCELLED' });

      await expect(service.remove(orgId, actorId, leaveId)).rejects.toThrow(BadRequestException);
    });

    it('does not set approvedBy when rejecting', async () => {
      prismaMock.leave.findFirst.mockResolvedValue({ id: leaveId, status: 'PENDING' });
      prismaMock.leave.update.mockResolvedValue({ id: leaveId, status: 'REJECTED' });

      await service.reject(orgId, actorId, leaveId);

      expect(prismaMock.leave.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'REJECTED' }),
        }),
      );
      const updateCall = prismaMock.leave.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('approvedBy');
    });

    it('sets approvedBy when approving', async () => {
      prismaMock.leave.findFirst.mockResolvedValue({ id: leaveId, status: 'PENDING' });
      prismaMock.leave.update.mockResolvedValue({ id: leaveId, status: 'APPROVED' });

      await service.approve(orgId, actorId, leaveId);

      expect(prismaMock.leave.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'APPROVED', approvedBy: actorId }),
        }),
      );
    });
  });

  describe('getStats', () => {
    it('returns leave statistics including cancelled', async () => {
      prismaMock.leave.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1);

      const result = await service.getStats(orgId);
      expect(result).toEqual({ total: 10, pending: 3, approved: 5, rejected: 2, cancelled: 1 });
    });

    it('returns zero cancelled when none exist', async () => {
      prismaMock.leave.count
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0);

      const result = await service.getStats(orgId);
      expect(result.cancelled).toBe(0);
    });

    it('scopes cancelled count to organization', async () => {
      prismaMock.leave.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1);

      await service.getStats(orgId);

      const countCalls = prismaMock.leave.count.mock.calls;
      for (const call of countCalls) {
        expect(call[0].where).toEqual(
          expect.objectContaining({ employee: { organizationId: orgId } }),
        );
      }
    });

    it('returns independent counts for mixed statuses', async () => {
      prismaMock.leave.count
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(6)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(2);

      const result = await service.getStats(orgId);
      expect(result.total).toBe(20);
      expect(result.pending).toBe(8);
      expect(result.approved).toBe(6);
      expect(result.rejected).toBe(4);
      expect(result.cancelled).toBe(2);
    });
  });
});
