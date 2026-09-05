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
        { id: '1', employeeId: 'emp-1', periodStart: new Date(), periodEnd: new Date(), netSalary: 5000 },
      ];
      prisma.payroll.findMany.mockResolvedValue(records);
      prisma.payroll.count.mockResolvedValue(1);

      const result = await service.findAll('org-1');

      expect(result.data).toEqual(records);
      expect(result.meta.total).toBe(1);
      expect(prisma.payroll.findMany).toHaveBeenCalled();
    });

    it('should filter by employeeId', async () => {
      prisma.payroll.findMany.mockResolvedValue([]);
      prisma.payroll.count.mockResolvedValue(0);
      await service.findAll('org-1', { employeeId: 'emp-1' });
      expect(prisma.payroll.findMany).toHaveBeenCalled();
    });

    it('should filter by period dates', async () => {
      prisma.payroll.findMany.mockResolvedValue([]);
      prisma.payroll.count.mockResolvedValue(0);
      await service.findAll('org-1', { periodStart: '2026-01-01', periodEnd: '2026-01-31' });
      expect(prisma.payroll.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return payroll record by id', async () => {
      const record = { id: '1', employeeId: 'emp-1', netSalary: 5000 };
      prisma.payroll.findFirst.mockResolvedValue(record);

      const result = await service.findOne('org-1', '1');

      expect(result).toEqual(record);
    });

    it('should throw NotFoundException if record not found', async () => {
      prisma.payroll.findFirst.mockResolvedValue(null);

      await expect(service.findOne('org-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create payroll record with correct net salary', async () => {
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
    it('should update payroll record', async () => {
      prisma.payroll.findFirst
        .mockResolvedValueOnce({ id: '1', employeeId: 'emp-1', basicSalary: 5000, allowances: 500, deductions: 200, tax: 300 })
        .mockResolvedValueOnce(null);
      prisma.payroll.update.mockResolvedValue({
        id: '1',
        employeeId: 'emp-1',
        basicSalary: 6000,
        allowances: 500,
        deductions: 200,
        tax: 300,
        netSalary: 6000,
        updatedAt: new Date(),
      });

      const result = await service.update('org-1', 'actor-1', '1', { basicSalary: 6000 });

      expect(result.basicSalary).toBe(6000);
      expect(auditService.record).toHaveBeenCalled();
    });

    it('should recalculate net salary on update', async () => {
      prisma.payroll.findFirst.mockResolvedValue({ id: '1', employeeId: 'emp-1', basicSalary: 5000, allowances: 500, deductions: 200, tax: 300 });
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
  });

  describe('remove', () => {
    it('should delete payroll record', async () => {
      prisma.payroll.findFirst.mockResolvedValue({
        id: '1',
        employeeId: 'emp-1',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-31'),
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
