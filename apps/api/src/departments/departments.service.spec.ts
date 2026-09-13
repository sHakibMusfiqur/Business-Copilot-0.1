import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';

import { DepartmentsService } from './departments.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('DepartmentsService', () => {
  let service: DepartmentsService;
  let prisma: {
    department: Record<string, jest.Mock>;
    employee: Record<string, jest.Mock>;
    user: Record<string, jest.Mock>;
    invitation: Record<string, jest.Mock>;
  };
  let auditService: { record: jest.Mock };

  beforeEach(async () => {
    prisma = {
      department: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      employee: { count: jest.fn() },
      user: { count: jest.fn(), findFirst: jest.fn() },
      invitation: { count: jest.fn() },
    };

    auditService = { record: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<DepartmentsService>(DepartmentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return departments for organization including shared', async () => {
      const departments = [
        { id: '1', name: 'Engineering', code: 'ENG', organizationId: 'org-1', managerId: null },
        { id: '2', name: 'Shared Dept', code: 'SHR', organizationId: null, managerId: null },
      ];
      prisma.department.findMany.mockResolvedValue(departments);

      const result = await service.findAll('org-1');

      expect(result).toHaveLength(2);
      expect(result[0].shared).toBe(false);
      expect(result[1].shared).toBe(true);
      expect(prisma.department.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          OR: [{ organizationId: 'org-1' }, { organizationId: null }],
        },
        orderBy: { name: 'asc' },
        select: expect.any(Object),
      });
    });

    it('should return empty array when no departments exist', async () => {
      prisma.department.findMany.mockResolvedValue([]);

      const result = await service.findAll('org-1');

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('should create a department', async () => {
      const department = { id: '1', name: 'Engineering', code: 'ENG', organizationId: 'org-1', managerId: null };
      prisma.department.create.mockResolvedValue(department);

      const result = await service.create('org-1', 'user-1', { name: 'Engineering', code: 'ENG' });

      expect(result.name).toBe('Engineering');
      expect(result.shared).toBe(false);
      expect(prisma.department.create).toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DEPARTMENT_CREATED' }),
      );
    });

    it('should validate managerId belongs to organization', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.create('org-1', 'user-1', { name: 'Engineering', code: 'ENG', managerId: 'bad-manager' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create department with valid managerId', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'manager-1' });
      prisma.department.create.mockResolvedValue({
        id: '1', name: 'Engineering', code: 'ENG', organizationId: 'org-1', managerId: 'manager-1',
      });

      const result = await service.create('org-1', 'user-1', {
        name: 'Engineering', code: 'ENG', managerId: 'manager-1',
      });

      expect(result.managerId).toBe('manager-1');
    });

    it('should trim and uppercase code', async () => {
      prisma.department.create.mockResolvedValue({
        id: '1', name: 'Engineering', code: 'ENG', organizationId: 'org-1', managerId: null,
      });

      await service.create('org-1', 'user-1', { name: 'Engineering', code: ' eng ' });

      expect(prisma.department.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ code: 'ENG' }),
        }),
      );
    });
  });

  describe('update', () => {
    it('should update a department', async () => {
      prisma.department.findFirst.mockResolvedValue({ id: '1', name: 'Engineering', code: 'ENG' });
      prisma.department.update.mockResolvedValue({
        id: '1', name: 'Engineering Updated', code: 'ENG', organizationId: 'org-1', managerId: null,
      });

      const result = await service.update('org-1', 'user-1', '1', { name: 'Engineering Updated' });

      expect(result.name).toBe('Engineering Updated');
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DEPARTMENT_UPDATED' }),
      );
    });

    it('should throw NotFoundException if department not found', async () => {
      prisma.department.findFirst.mockResolvedValue(null);

      await expect(
        service.update('org-1', 'user-1', 'nonexistent', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should validate managerId on update', async () => {
      prisma.department.findFirst.mockResolvedValue({ id: '1', name: 'Engineering', code: 'ENG' });
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.update('org-1', 'user-1', '1', { managerId: 'bad-manager' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should delete a department with no dependencies', async () => {
      prisma.department.findFirst.mockResolvedValue({ id: '1', name: 'Engineering' });
      prisma.employee.count.mockResolvedValue(0);
      prisma.user.count.mockResolvedValue(0);
      prisma.invitation.count.mockResolvedValue(0);
      prisma.department.delete.mockResolvedValue({});

      const result = await service.remove('org-1', 'user-1', '1');

      expect(result.message).toBe('Department deleted successfully');
      expect(prisma.department.delete).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DEPARTMENT_DELETED' }),
      );
    });

    it('should throw NotFoundException if department not found', async () => {
      prisma.department.findFirst.mockResolvedValue(null);

      await expect(service.remove('org-1', 'user-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should reject deletion when employees are linked', async () => {
      prisma.department.findFirst.mockResolvedValue({ id: '1', name: 'Engineering' });
      prisma.employee.count.mockResolvedValue(3);
      prisma.user.count.mockResolvedValue(0);
      prisma.invitation.count.mockResolvedValue(0);

      await expect(service.remove('org-1', 'user-1', '1')).rejects.toThrow(BadRequestException);
      expect(prisma.department.delete).not.toHaveBeenCalled();
    });

    it('should reject deletion when users are linked', async () => {
      prisma.department.findFirst.mockResolvedValue({ id: '1', name: 'Engineering' });
      prisma.employee.count.mockResolvedValue(0);
      prisma.user.count.mockResolvedValue(2);
      prisma.invitation.count.mockResolvedValue(0);

      await expect(service.remove('org-1', 'user-1', '1')).rejects.toThrow(BadRequestException);
      expect(prisma.department.delete).not.toHaveBeenCalled();
    });

    it('should reject deletion when invitations are linked', async () => {
      prisma.department.findFirst.mockResolvedValue({ id: '1', name: 'Engineering' });
      prisma.employee.count.mockResolvedValue(0);
      prisma.user.count.mockResolvedValue(0);
      prisma.invitation.count.mockResolvedValue(1);

      await expect(service.remove('org-1', 'user-1', '1')).rejects.toThrow(BadRequestException);
      expect(prisma.department.delete).not.toHaveBeenCalled();
    });

    it('should reject deletion when multiple dependency types exist', async () => {
      prisma.department.findFirst.mockResolvedValue({ id: '1', name: 'Engineering' });
      prisma.employee.count.mockResolvedValue(5);
      prisma.user.count.mockResolvedValue(2);
      prisma.invitation.count.mockResolvedValue(1);

      await expect(service.remove('org-1', 'user-1', '1')).rejects.toThrow(BadRequestException);
      expect(prisma.department.delete).not.toHaveBeenCalled();
    });
  });

  describe('tenant isolation', () => {
    it('should not find department from another organization', async () => {
      prisma.department.findFirst.mockResolvedValue(null);

      await expect(
        service.update('org-1', 'user-1', 'dept-from-org-2', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should scope findAll to organization', async () => {
      prisma.department.findMany.mockResolvedValue([]);

      await service.findAll('org-1');

      expect(prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ organizationId: 'org-1' }, { organizationId: null }],
          }),
        }),
      );
    });
  });
});
