import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';

import { EmployeesService } from './employees.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('EmployeesService', () => {
  let service: EmployeesService;
  let prisma: { employee: Record<string, jest.Mock>; department: Record<string, jest.Mock>; user: Record<string, jest.Mock> };
  let auditService: { record: jest.Mock };

  beforeEach(async () => {
    prisma = {
      employee: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        groupBy: jest.fn(),
      },
      department: {
        findFirst: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
    };

    auditService = {
      record: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return employees for organization', async () => {
      const employees = [
        { id: '1', employeeCode: 'EMP-0001', firstName: 'John', lastName: 'Doe', email: 'john@test.com' },
      ];
      prisma.employee.findMany.mockResolvedValue(employees);

      const result = await service.findAll('org-1');

      expect(result).toEqual(employees);
      expect(prisma.employee.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return employee by id', async () => {
      const employee = { id: '1', employeeCode: 'EMP-0001', firstName: 'John', lastName: 'Doe' };
      prisma.employee.findFirst.mockResolvedValue(employee);

      const result = await service.findOne('org-1', '1');

      expect(result).toEqual(employee);
    });

    it('should throw NotFoundException if employee not found', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(service.findOne('org-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create employee', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);
      prisma.department.findFirst.mockResolvedValue({ id: 'dept-1' });
      prisma.employee.count.mockResolvedValue(0);
      prisma.employee.create.mockResolvedValue({
        id: '1',
        employeeCode: 'EMP-0001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        isActive: true,
        createdAt: new Date(),
      });

      const result = await service.create('org-1', 'actor-1', {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
      });

      expect(result.employeeCode).toBe('EMP-0001');
      expect(auditService.record).toHaveBeenCalled();
    });

    it('should throw ConflictException if email exists', async () => {
      prisma.employee.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.create('org-1', 'actor-1', {
        firstName: 'John',
        lastName: 'Doe',
        email: 'existing@test.com',
      })).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should delete employee', async () => {
      prisma.employee.findFirst.mockResolvedValue({
        id: '1',
        employeeCode: 'EMP-0001',
        firstName: 'John',
        lastName: 'Doe',
      });
      prisma.employee.delete.mockResolvedValue({});

      const result = await service.remove('org-1', 'actor-1', '1');

      expect(result.message).toBe('Employee deleted successfully');
      expect(auditService.record).toHaveBeenCalled();
    });

    it('should throw NotFoundException if employee not found', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(service.remove('org-1', 'actor-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
