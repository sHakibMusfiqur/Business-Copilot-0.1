import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';

import { PayrollService } from './payroll.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('PayrollService', () => {
  let service: PayrollService;
  let prisma: { payroll: Record<string, jest.Mock>; employee: Record<string, jest.Mock> };
  let auditService: { record: jest.Mock };

  beforeEach(async () => {
    prisma = {
      payroll: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        aggregate: jest.fn(),
        groupBy: jest.fn(),
      },
      employee: {
        findFirst: jest.fn(),
      },
    };

    auditService = {
      record: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<PayrollService>(PayrollService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return payroll records for organization', async () => {
      const records = [
        { id: '1', employeeId: 'emp-1', periodStart: new Date(), periodEnd: new Date(), netSalary: 5000, status: 'DRAFT' },
      ];
      prisma.payroll.findMany.mockResolvedValue(records);
      prisma.payroll.count.mockResolvedValue(1);

      const result = await service.findAll('org-1');

      expect(result.data).toEqual(records);
      expect(result.meta.total).toBe(1);
      expect(prisma.payroll.findMany).toHaveBeenCalled();
    });

    it('should return { data, meta } shape matching frontend contract', async () => {
      const records = [
        { id: '1', employeeId: 'emp-1', periodStart: new Date(), periodEnd: new Date(), netSalary: 5000, status: 'DRAFT' },
        { id: '2', employeeId: 'emp-2', periodStart: new Date(), periodEnd: new Date(), netSalary: 3000, status: 'PENDING' },
      ];
      prisma.payroll.findMany.mockResolvedValue(records);
      prisma.payroll.count.mockResolvedValue(2);

      const result = await service.findAll('org-1', { page: 1, limit: 20 });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ total: 2, page: 1, limit: 20, totalPages: 1 });
    });

    it('should return updatedAt in each record', async () => {
      const now = new Date();
      const records = [
        { id: '1', employeeId: 'emp-1', periodStart: now, periodEnd: now, netSalary: 5000, status: 'DRAFT', updatedAt: now },
      ];
      prisma.payroll.findMany.mockResolvedValue(records);
      prisma.payroll.count.mockResolvedValue(1);

      const result = await service.findAll('org-1');

      expect(result.data[0]).toHaveProperty('updatedAt');
    });

    it('should filter by employeeId', async () => {
      prisma.payroll.findMany.mockResolvedValue([]);
      prisma.payroll.count.mockResolvedValue(0);
      await service.findAll('org-1', { employeeId: 'emp-1' });
      const callArgs = prisma.payroll.findMany.mock.calls[0][0];
      expect(callArgs.where.AND).toBeDefined();
      expect(callArgs.where.AND).toContainEqual({ employeeId: 'emp-1' });
    });

    it('should filter by periodStart', async () => {
      prisma.payroll.findMany.mockResolvedValue([]);
      prisma.payroll.count.mockResolvedValue(0);
      await service.findAll('org-1', { periodStart: '2026-01-01' });
      const callArgs = prisma.payroll.findMany.mock.calls[0][0];
      expect(callArgs.where.AND).toContainEqual({ periodStart: { gte: new Date('2026-01-01') } });
    });

    it('should filter by periodEnd', async () => {
      prisma.payroll.findMany.mockResolvedValue([]);
      prisma.payroll.count.mockResolvedValue(0);
      await service.findAll('org-1', { periodEnd: '2026-01-31' });
      const callArgs = prisma.payroll.findMany.mock.calls[0][0];
      expect(callArgs.where.AND).toContainEqual({ periodEnd: { lte: new Date('2026-01-31') } });
    });

    it('should filter by both period dates', async () => {
      prisma.payroll.findMany.mockResolvedValue([]);
      prisma.payroll.count.mockResolvedValue(0);
      await service.findAll('org-1', { periodStart: '2026-01-01', periodEnd: '2026-01-31' });
      const callArgs = prisma.payroll.findMany.mock.calls[0][0];
      expect(callArgs.where.AND).toContainEqual({ periodStart: { gte: new Date('2026-01-01') } });
      expect(callArgs.where.AND).toContainEqual({ periodEnd: { lte: new Date('2026-01-31') } });
    });

    it('should always include tenant scope in AND structure', async () => {
      prisma.payroll.findMany.mockResolvedValue([]);
      prisma.payroll.count.mockResolvedValue(0);
      await service.findAll('org-1', { search: 'john' });
      const callArgs = prisma.payroll.findMany.mock.calls[0][0];
      expect(callArgs.where.AND).toContainEqual({ employee: { organizationId: 'org-1' } });
    });

    it('should search across employee fields with OR inside AND', async () => {
      prisma.payroll.findMany.mockResolvedValue([]);
      prisma.payroll.count.mockResolvedValue(0);

      await service.findAll('org-1', { search: 'john' });

      const callArgs = prisma.payroll.findMany.mock.calls[0][0];
      const searchCondition = callArgs.where.AND.find(
        (c: Record<string, unknown>) => Array.isArray(c.OR),
      );
      expect(searchCondition).toBeDefined();
      expect(searchCondition.OR).toHaveLength(4);
      expect(searchCondition.OR[0]).toEqual({
        employee: { firstName: { contains: 'john', mode: 'insensitive' } },
      });
    });

    it('should combine search, period filters, and employeeId in AND', async () => {
      prisma.payroll.findMany.mockResolvedValue([]);
      prisma.payroll.count.mockResolvedValue(0);

      await service.findAll('org-1', {
        search: 'doe',
        employeeId: 'emp-1',
        periodStart: '2026-01-01',
        periodEnd: '2026-06-30',
        sortBy: 'netSalary',
        sortOrder: 'asc',
        page: 2,
        limit: 10,
      });

      const callArgs = prisma.payroll.findMany.mock.calls[0][0];
      expect(callArgs.where.AND).toContainEqual({ employee: { organizationId: 'org-1' } });
      expect(callArgs.where.AND).toContainEqual({ employeeId: 'emp-1' });
      expect(callArgs.where.AND).toContainEqual({ periodStart: { gte: new Date('2026-01-01') } });
      expect(callArgs.where.AND).toContainEqual({ periodEnd: { lte: new Date('2026-06-30') } });
      const searchCondition = callArgs.where.AND.find(
        (c: Record<string, unknown>) => Array.isArray(c.OR),
      );
      expect(searchCondition).toBeDefined();
      expect(callArgs.orderBy).toEqual({ netSalary: 'asc' });
      expect(callArgs.skip).toBe(10);
      expect(callArgs.take).toBe(10);
    });

    it('should use configurable sortBy and sortOrder', async () => {
      prisma.payroll.findMany.mockResolvedValue([]);
      prisma.payroll.count.mockResolvedValue(0);

      await service.findAll('org-1', { sortBy: 'basicSalary', sortOrder: 'asc' });

      const callArgs = prisma.payroll.findMany.mock.calls[0][0];
      expect(callArgs.orderBy).toEqual({ basicSalary: 'asc' });
    });

    it('should sort by paymentDate asc', async () => {
      prisma.payroll.findMany.mockResolvedValue([]);
      prisma.payroll.count.mockResolvedValue(0);

      await service.findAll('org-1', { sortBy: 'paymentDate', sortOrder: 'asc' });

      const callArgs = prisma.payroll.findMany.mock.calls[0][0];
      expect(callArgs.orderBy).toEqual({ paymentDate: 'asc' });
    });

    it('should sort by paymentDate desc', async () => {
      prisma.payroll.findMany.mockResolvedValue([]);
      prisma.payroll.count.mockResolvedValue(0);

      await service.findAll('org-1', { sortBy: 'paymentDate', sortOrder: 'desc' });

      const callArgs = prisma.payroll.findMany.mock.calls[0][0];
      expect(callArgs.orderBy).toEqual({ paymentDate: 'desc' });
    });

    it('should default orderBy to periodEnd desc', async () => {
      prisma.payroll.findMany.mockResolvedValue([]);
      prisma.payroll.count.mockResolvedValue(0);

      await service.findAll('org-1');

      const callArgs = prisma.payroll.findMany.mock.calls[0][0];
      expect(callArgs.orderBy).toEqual({ periodEnd: 'desc' });
    });

    it('should default limit to 20', async () => {
      prisma.payroll.findMany.mockResolvedValue([]);
      prisma.payroll.count.mockResolvedValue(0);

      await service.findAll('org-1', { page: 1 });

      const callArgs = prisma.payroll.findMany.mock.calls[0][0];
      expect(callArgs.take).toBe(20);
    });

    it('should include status in select', async () => {
      prisma.payroll.findMany.mockResolvedValue([]);
      prisma.payroll.count.mockResolvedValue(0);

      await service.findAll('org-1');

      const callArgs = prisma.payroll.findMany.mock.calls[0][0];
      expect(callArgs.select.status).toBe(true);
      expect(callArgs.select.approvedBy).toBe(true);
      expect(callArgs.select.approvedAt).toBe(true);
      expect(callArgs.select.rejectedBy).toBe(true);
      expect(callArgs.select.rejectedAt).toBe(true);
    });
  });

  describe('create', () => {
    it('should create payroll record with correct net salary and DRAFT status', async () => {
      prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', firstName: 'John', lastName: 'Doe' });
      prisma.payroll.findFirst.mockResolvedValue(null);
      prisma.payroll.create.mockResolvedValue({
        id: '1',
        employeeId: 'emp-1',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-31'),
        basicSalary: 5000,
        allowances: 500,
        deductions: 200,
        tax: 300,
        netSalary: 5000,
        status: 'DRAFT',
        createdAt: new Date(),
      });

      const result = await service.create('org-1', 'actor-1', {
        employeeId: 'emp-1',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        basicSalary: 5000,
        allowances: 500,
        deductions: 200,
        tax: 300,
      });

      expect(result.netSalary).toBe(5000);
      expect(result.status).toBe('DRAFT');
      expect(auditService.record).toHaveBeenCalled();
    });

    it('should calculate net salary correctly', async () => {
      prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', firstName: 'John', lastName: 'Doe' });
      prisma.payroll.findFirst.mockResolvedValue(null);
      prisma.payroll.create.mockImplementation(async (args) => ({
        id: '1',
        ...args.data,
        createdAt: new Date(),
      }));

      const result = await service.create('org-1', 'actor-1', {
        employeeId: 'emp-1',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        basicSalary: 10000,
        allowances: 2000,
        deductions: 1000,
        tax: 1500,
      });

      expect(result.netSalary).toBe(9500);
    });

    it('should throw BadRequestException if employee not in org', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(service.create('org-1', 'actor-1', {
        employeeId: 'invalid-emp',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        basicSalary: 5000,
      })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for duplicate employee and period', async () => {
      prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', firstName: 'John', lastName: 'Doe' });
      prisma.payroll.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.create('org-1', 'actor-1', {
        employeeId: 'emp-1',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        basicSalary: 5000,
      })).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update DRAFT payroll record', async () => {
      prisma.payroll.findFirst
        .mockResolvedValueOnce({ id: '1', employeeId: 'emp-1', basicSalary: 5000, allowances: 500, deductions: 200, tax: 300, status: 'DRAFT' })
        .mockResolvedValueOnce(null);
      prisma.payroll.update.mockResolvedValue({
        id: '1',
        employeeId: 'emp-1',
        basicSalary: 6000,
        allowances: 500,
        deductions: 200,
        tax: 300,
        netSalary: 6000,
        status: 'DRAFT',
        updatedAt: new Date(),
      });

      const result = await service.update('org-1', 'actor-1', '1', { basicSalary: 6000 });

      expect(result.basicSalary).toBe(6000);
      expect(auditService.record).toHaveBeenCalled();
    });

    it('should recalculate net salary on update', async () => {
      prisma.payroll.findFirst.mockResolvedValue({ id: '1', employeeId: 'emp-1', basicSalary: 5000, allowances: 500, deductions: 200, tax: 300, status: 'DRAFT' });
      prisma.payroll.update.mockImplementation(async (args) => ({
        id: '1',
        ...args.data,
        updatedAt: new Date(),
      }));

      const result = await service.update('org-1', 'actor-1', '1', { basicSalary: 8000 });

      expect(result.netSalary).toBe(8000);
    });

    it('should throw NotFoundException if record not found', async () => {
      prisma.payroll.findFirst.mockResolvedValue(null);

      await expect(service.update('org-1', 'actor-1', 'nonexistent', { basicSalary: 6000 })).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when updating PENDING payroll', async () => {
      prisma.payroll.findFirst.mockResolvedValue({ id: '1', employeeId: 'emp-1', basicSalary: 5000, allowances: 500, deductions: 200, tax: 300, status: 'PENDING' });

      await expect(service.update('org-1', 'actor-1', '1', { basicSalary: 6000 })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when updating APPROVED payroll', async () => {
      prisma.payroll.findFirst.mockResolvedValue({ id: '1', employeeId: 'emp-1', basicSalary: 5000, allowances: 500, deductions: 200, tax: 300, status: 'APPROVED' });

      await expect(service.update('org-1', 'actor-1', '1', { basicSalary: 6000 })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when updating REJECTED payroll', async () => {
      prisma.payroll.findFirst.mockResolvedValue({ id: '1', employeeId: 'emp-1', basicSalary: 5000, allowances: 500, deductions: 200, tax: 300, status: 'REJECTED' });

      await expect(service.update('org-1', 'actor-1', '1', { basicSalary: 6000 })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when updating PAID payroll', async () => {
      prisma.payroll.findFirst.mockResolvedValue({ id: '1', employeeId: 'emp-1', basicSalary: 5000, allowances: 500, deductions: 200, tax: 300, status: 'PAID' });

      await expect(service.update('org-1', 'actor-1', '1', { basicSalary: 6000 })).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should delete DRAFT payroll record', async () => {
      prisma.payroll.findFirst.mockResolvedValue({
        id: '1',
        employeeId: 'emp-1',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-31'),
        status: 'DRAFT',
      });
      prisma.payroll.delete.mockResolvedValue({});

      const result = await service.remove('org-1', 'actor-1', '1');

      expect(result.message).toBe('Payroll record deleted successfully');
      expect(auditService.record).toHaveBeenCalled();
    });

    it('should throw NotFoundException if record not found', async () => {
      prisma.payroll.findFirst.mockResolvedValue(null);

      await expect(service.remove('org-1', 'actor-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when deleting PENDING payroll', async () => {
      prisma.payroll.findFirst.mockResolvedValue({ id: '1', status: 'PENDING' });

      await expect(service.remove('org-1', 'actor-1', '1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when deleting APPROVED payroll', async () => {
      prisma.payroll.findFirst.mockResolvedValue({ id: '1', status: 'APPROVED' });

      await expect(service.remove('org-1', 'actor-1', '1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when deleting REJECTED payroll', async () => {
      prisma.payroll.findFirst.mockResolvedValue({ id: '1', status: 'REJECTED' });

      await expect(service.remove('org-1', 'actor-1', '1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when deleting PAID payroll', async () => {
      prisma.payroll.findFirst.mockResolvedValue({ id: '1', status: 'PAID' });

      await expect(service.remove('org-1', 'actor-1', '1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('submit', () => {
    it('should transition DRAFT to PENDING', async () => {
      prisma.payroll.findFirst
        .mockResolvedValueOnce({ id: '1', status: 'DRAFT' })
        .mockResolvedValueOnce({ id: '1', status: 'PENDING', employee: { id: 'emp-1' } });
      prisma.payroll.updateMany.mockResolvedValue({ count: 1 });

      await service.submit('org-1', 'actor-1', '1');

      expect(prisma.payroll.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING' }) }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYROLL_SUBMITTED' }),
      );
    });

    it('should throw NotFoundException if record not found', async () => {
      prisma.payroll.findFirst.mockResolvedValue(null);

      await expect(service.submit('org-1', 'actor-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when submitting PENDING payroll', async () => {
      prisma.payroll.findFirst.mockResolvedValue({ id: '1', status: 'PENDING' });

      await expect(service.submit('org-1', 'actor-1', '1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when submitting APPROVED payroll', async () => {
      prisma.payroll.findFirst.mockResolvedValue({ id: '1', status: 'APPROVED' });

      await expect(service.submit('org-1', 'actor-1', '1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when concurrent modification detected', async () => {
      prisma.payroll.findFirst.mockResolvedValue({ id: '1', status: 'DRAFT' });
      prisma.payroll.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.submit('org-1', 'actor-1', '1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('approve', () => {
    it('should transition PENDING to APPROVED with approvedBy and approvedAt', async () => {
      prisma.payroll.findFirst
        .mockResolvedValueOnce({ id: '1', status: 'PENDING' })
        .mockResolvedValueOnce({ id: '1', status: 'APPROVED', approvedBy: 'actor-1', employee: { id: 'emp-1' } });
      prisma.payroll.updateMany.mockResolvedValue({ count: 1 });

      await service.approve('org-1', 'actor-1', '1');

      expect(prisma.payroll.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'APPROVED',
            approvedBy: 'actor-1',
            approvedAt: expect.any(Date),
          }),
        }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYROLL_APPROVED' }),
      );
    });

    it('should throw NotFoundException if record not found', async () => {
      prisma.payroll.findFirst.mockResolvedValue(null);

      await expect(service.approve('org-1', 'actor-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when approving DRAFT payroll', async () => {
      prisma.payroll.findFirst.mockResolvedValue({ id: '1', status: 'DRAFT' });

      await expect(service.approve('org-1', 'actor-1', '1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when approving APPROVED payroll', async () => {
      prisma.payroll.findFirst.mockResolvedValue({ id: '1', status: 'APPROVED' });

      await expect(service.approve('org-1', 'actor-1', '1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when approving REJECTED payroll', async () => {
      prisma.payroll.findFirst.mockResolvedValue({ id: '1', status: 'REJECTED' });

      await expect(service.approve('org-1', 'actor-1', '1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when approving PAID payroll', async () => {
      prisma.payroll.findFirst.mockResolvedValue({ id: '1', status: 'PAID' });

      await expect(service.approve('org-1', 'actor-1', '1')).rejects.toThrow(BadRequestException);
    });

    it('should not modify salary fields during approval', async () => {
      prisma.payroll.findFirst
        .mockResolvedValueOnce({ id: '1', status: 'PENDING' })
        .mockResolvedValueOnce({ id: '1', status: 'APPROVED', basicSalary: 5000, netSalary: 5000, employee: { id: 'emp-1' } });
      prisma.payroll.updateMany.mockResolvedValue({ count: 1 });

      await service.approve('org-1', 'actor-1', '1');

      const updateCall = prisma.payroll.updateMany.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('basicSalary');
      expect(updateCall.data).not.toHaveProperty('netSalary');
    });
  });

  describe('reject', () => {
    it('should transition PENDING to REJECTED with rejectedBy and rejectedAt', async () => {
      prisma.payroll.findFirst
        .mockResolvedValueOnce({ id: '1', status: 'PENDING' })
        .mockResolvedValueOnce({ id: '1', status: 'REJECTED', rejectedBy: 'actor-1', employee: { id: 'emp-1' } });
      prisma.payroll.updateMany.mockResolvedValue({ count: 1 });

      await service.reject('org-1', 'actor-1', '1');

      expect(prisma.payroll.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'REJECTED',
            rejectedBy: 'actor-1',
            rejectedAt: expect.any(Date),
          }),
        }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYROLL_REJECTED' }),
      );
    });

    it('should throw NotFoundException if record not found', async () => {
      prisma.payroll.findFirst.mockResolvedValue(null);

      await expect(service.reject('org-1', 'actor-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when rejecting DRAFT payroll', async () => {
      prisma.payroll.findFirst.mockResolvedValue({ id: '1', status: 'DRAFT' });

      await expect(service.reject('org-1', 'actor-1', '1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when rejecting APPROVED payroll', async () => {
      prisma.payroll.findFirst.mockResolvedValue({ id: '1', status: 'APPROVED' });

      await expect(service.reject('org-1', 'actor-1', '1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when rejecting REJECTED payroll', async () => {
      prisma.payroll.findFirst.mockResolvedValue({ id: '1', status: 'REJECTED' });

      await expect(service.reject('org-1', 'actor-1', '1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when rejecting PAID payroll', async () => {
      prisma.payroll.findFirst.mockResolvedValue({ id: '1', status: 'PAID' });

      await expect(service.reject('org-1', 'actor-1', '1')).rejects.toThrow(BadRequestException);
    });

    it('should not modify salary fields during rejection', async () => {
      prisma.payroll.findFirst
        .mockResolvedValueOnce({ id: '1', status: 'PENDING' })
        .mockResolvedValueOnce({ id: '1', status: 'REJECTED', basicSalary: 5000, netSalary: 5000, employee: { id: 'emp-1' } });
      prisma.payroll.updateMany.mockResolvedValue({ count: 1 });

      await service.reject('org-1', 'actor-1', '1');

      const updateCall = prisma.payroll.updateMany.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('basicSalary');
      expect(updateCall.data).not.toHaveProperty('netSalary');
    });
  });

  describe('markAsPaid', () => {
    it('should transition APPROVED to PAID with paymentDate', async () => {
      prisma.payroll.findFirst
        .mockResolvedValueOnce({ id: '1', status: 'APPROVED' })
        .mockResolvedValueOnce({ id: '1', status: 'PAID', paymentDate: new Date('2026-01-15'), employee: { id: 'emp-1' } });
      prisma.payroll.updateMany.mockResolvedValue({ count: 1 });

      await service.markAsPaid('org-1', 'actor-1', '1', { paymentDate: '2026-01-15' });

      expect(prisma.payroll.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PAID',
            paymentDate: expect.any(Date),
          }),
        }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYROLL_PAID' }),
      );
    });

    it('should default paymentDate to today when not provided', async () => {
      prisma.payroll.findFirst
        .mockResolvedValueOnce({ id: '1', status: 'APPROVED' })
        .mockResolvedValueOnce({ id: '1', status: 'PAID', paymentDate: new Date(), employee: { id: 'emp-1' } });
      prisma.payroll.updateMany.mockResolvedValue({ count: 1 });

      await service.markAsPaid('org-1', 'actor-1', '1', {});

      const updateCall = prisma.payroll.updateMany.mock.calls[0][0];
      expect(updateCall.data.paymentDate).toBeInstanceOf(Date);
    });

    it('should throw NotFoundException if record not found', async () => {
      prisma.payroll.findFirst.mockResolvedValue(null);

      await expect(service.markAsPaid('org-1', 'actor-1', 'nonexistent', {})).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when marking DRAFT as paid', async () => {
      prisma.payroll.findFirst.mockResolvedValue({ id: '1', status: 'DRAFT' });

      await expect(service.markAsPaid('org-1', 'actor-1', '1', {})).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when marking PENDING as paid', async () => {
      prisma.payroll.findFirst.mockResolvedValue({ id: '1', status: 'PENDING' });

      await expect(service.markAsPaid('org-1', 'actor-1', '1', {})).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when marking REJECTED as paid', async () => {
      prisma.payroll.findFirst.mockResolvedValue({ id: '1', status: 'REJECTED' });

      await expect(service.markAsPaid('org-1', 'actor-1', '1', {})).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when marking PAID as paid', async () => {
      prisma.payroll.findFirst.mockResolvedValue({ id: '1', status: 'PAID' });

      await expect(service.markAsPaid('org-1', 'actor-1', '1', {})).rejects.toThrow(BadRequestException);
    });

    it('should not modify salary fields during pay', async () => {
      prisma.payroll.findFirst
        .mockResolvedValueOnce({ id: '1', status: 'APPROVED' })
        .mockResolvedValueOnce({ id: '1', status: 'PAID', basicSalary: 5000, netSalary: 5000, employee: { id: 'emp-1' } });
      prisma.payroll.updateMany.mockResolvedValue({ count: 1 });

      await service.markAsPaid('org-1', 'actor-1', '1', {});

      const updateCall = prisma.payroll.updateMany.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('basicSalary');
      expect(updateCall.data).not.toHaveProperty('netSalary');
    });
  });

  describe('getStats', () => {
    it('should return payroll statistics', async () => {
      prisma.payroll.count.mockResolvedValue(10);
      prisma.payroll.aggregate.mockResolvedValue({
        _sum: { netSalary: 50000, basicSalary: 40000, allowances: 15000, deductions: 3000, tax: 2000 },
      });
      prisma.payroll.groupBy.mockResolvedValue([
        { periodStart: new Date('2026-01-01'), _sum: { netSalary: 5000 }, _count: { id: 2 } },
      ]);

      const result = await service.getStats('org-1');

      expect(result.total).toBe(10);
      expect(result.totalNetSalary).toBe(50000);
      expect(result.totalBasicSalary).toBe(40000);
      expect(result.totalAllowances).toBe(15000);
      expect(result.totalDeductions).toBe(3000);
      expect(result.totalTax).toBe(2000);
      expect(result.byMonth).toHaveLength(1);
    });
  });
});
