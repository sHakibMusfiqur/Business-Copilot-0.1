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

      const result = await service.findAll('org-1');

      expect(result).toEqual(records);
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
    it('should create payroll record', async () => {
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

    it('should throw BadRequestException if employee not in org', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(service.create('org-1', 'actor-1', {
        employeeId: 'invalid-emp',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        basicSalary: 5000,
      })).rejects.toThrow(BadRequestException);
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
});
