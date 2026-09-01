import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

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

    it('should filter by search term', async () => {
      prisma.employee.findMany.mockResolvedValue([]);
      await service.findAll('org-1', { search: 'John' });
      expect(prisma.employee.findMany).toHaveBeenCalled();
    });

    it('should filter by department', async () => {
      prisma.employee.findMany.mockResolvedValue([]);
      await service.findAll('org-1', { departmentId: 'dept-1' });
      expect(prisma.employee.findMany).toHaveBeenCalled();
    });

    it('should filter by active status', async () => {
      prisma.employee.findMany.mockResolvedValue([]);
      await service.findAll('org-1', { isActive: true });
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

    it('should throw BadRequestException if department not in org', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);
      prisma.department.findFirst.mockResolvedValue(null);

      await expect(service.create('org-1', 'actor-1', {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        departmentId: 'invalid-dept',
      })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if userId not in org', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.create('org-1', 'actor-1', {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        userId: 'invalid-user',
      })).rejects.toThrow(BadRequestException);
    });

    it('should retry on P2002 employeeCode collision and succeed', async () => {
      prisma.employee.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ employeeCode: 'EMP-0001' });
      prisma.department.findFirst.mockResolvedValue({ id: 'dept-1' });

      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '5.0.0', meta: { target: ['employeeCode'] } },
      );

      prisma.employee.create
        .mockRejectedValueOnce(p2002Error)
        .mockResolvedValueOnce({
          id: '2',
          employeeCode: 'EMP-0002',
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

      expect(result.employeeCode).toBe('EMP-0002');
      expect(prisma.employee.create).toHaveBeenCalledTimes(2);
      expect(auditService.record).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException after exhausting retries', async () => {
      prisma.employee.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ employeeCode: 'EMP-0001' });
      prisma.department.findFirst.mockResolvedValue({ id: 'dept-1' });

      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '5.0.0', meta: { target: ['employeeCode'] } },
      );

      prisma.employee.create.mockRejectedValue(p2002Error);

      await expect(service.create('org-1', 'actor-1', {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
      })).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('update', () => {
    it('should update employee', async () => {
      prisma.employee.findFirst
        .mockResolvedValueOnce({ id: '1', employeeCode: 'EMP-0001', firstName: 'John', lastName: 'Doe' })
        .mockResolvedValueOnce(null);
      prisma.employee.update.mockResolvedValue({
        id: '1',
        employeeCode: 'EMP-0001',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'john@test.com',
        isActive: true,
        updatedAt: new Date(),
      });

      const result = await service.update('org-1', 'actor-1', '1', { firstName: 'Jane' });

      expect(result.firstName).toBe('Jane');
      expect(auditService.record).toHaveBeenCalled();
    });

    it('should throw NotFoundException if employee not found', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(service.update('org-1', 'actor-1', 'nonexistent', { firstName: 'Jane' })).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if department not in org', async () => {
      prisma.employee.findFirst.mockResolvedValue({ id: '1', employeeCode: 'EMP-0001', firstName: 'John', lastName: 'Doe' });
      prisma.department.findFirst.mockResolvedValue(null);

      await expect(service.update('org-1', 'actor-1', '1', { departmentId: 'invalid-dept' })).rejects.toThrow(BadRequestException);
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

  describe('getStats', () => {
    it('should return employee statistics', async () => {
      prisma.employee.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(8);
      prisma.employee.groupBy.mockResolvedValue([
        { departmentId: 'dept-1', _count: { id: 5 } },
        { departmentId: 'dept-2', _count: { id: 3 } },
      ]);

      const result = await service.getStats('org-1');

      expect(result.total).toBe(10);
      expect(result.active).toBe(8);
      expect(result.inactive).toBe(2);
      expect(result.byDepartment).toHaveLength(2);
    });
  });
});
