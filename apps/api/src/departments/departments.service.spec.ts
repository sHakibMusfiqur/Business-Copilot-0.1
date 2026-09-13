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
        { id: '1', name: 'Engineering', code: 'ENG', organizationId: 'org-1', managerId: null, isActive: true },
        { id: '2', name: 'Shared Dept', code: 'SHR', organizationId: null, managerId: null, isActive: true },
      ];
      prisma.department.findMany.mockResolvedValue(departments);

      const result = await service.findAll('org-1');

      expect(result).toHaveLength(2);
      expect(result[0].shared).toBe(false);
      expect(result[0].isActive).toBe(true);
      expect(result[1].shared).toBe(true);
      expect(result[1].isActive).toBe(true);
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

    it('should include isActive in the response', async () => {
      prisma.department.findMany.mockResolvedValue([
        { id: '1', name: 'Engineering', code: 'ENG', organizationId: 'org-1', managerId: null, isActive: true },
      ]);

      const result = await service.findAll('org-1');

      expect(result[0]).toHaveProperty('isActive', true);
    });
  });

  describe('create', () => {
    it('should create a department', async () => {
      const department = { id: '1', name: 'Engineering', code: 'ENG', organizationId: 'org-1', managerId: null, isActive: true };
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
        id: '1', name: 'Engineering', code: 'ENG', organizationId: 'org-1', managerId: 'manager-1', isActive: true,
      });

      const result = await service.create('org-1', 'user-1', {
        name: 'Engineering', code: 'ENG', managerId: 'manager-1',
      });

      expect(result.managerId).toBe('manager-1');
    });

    it('should trim and uppercase code', async () => {
      prisma.department.create.mockResolvedValue({
        id: '1', name: 'Engineering', code: 'ENG', organizationId: 'org-1', managerId: null, isActive: true,
      });

      await service.create('org-1', 'user-1', { name: 'Engineering', code: ' eng ' });

      expect(prisma.department.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ code: 'ENG' }),
        }),
      );
    });

    it('should reject create with duplicate code', async () => {
      prisma.department.findFirst.mockResolvedValue({ id: 'existing', code: 'ENG' });

      await expect(
        service.create('org-1', 'user-1', { name: 'Engineering', code: 'ENG' }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.department.create).not.toHaveBeenCalled();
    });

    it('should allow creating with same code after normalization', async () => {
      prisma.department.findFirst.mockResolvedValue(null);
      prisma.department.create.mockResolvedValue({
        id: '1', name: 'Engineering', code: 'ENG', organizationId: 'org-1', managerId: null, isActive: true,
      });

      await service.create('org-1', 'user-1', { name: 'Engineering', code: ' eng ' });

      expect(prisma.department.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ code: 'ENG' }),
        }),
      );
    });
  });

  describe('update', () => {
    it('should update a department', async () => {
      prisma.department.findFirst.mockResolvedValue({ id: '1', name: 'Engineering', code: 'ENG' });
      prisma.department.update.mockResolvedValue({
        id: '1', name: 'Engineering Updated', code: 'ENG', organizationId: 'org-1', managerId: null, isActive: true,
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

    it('should include isActive in update response', async () => {
      prisma.department.findFirst.mockResolvedValue({ id: '1', name: 'Engineering', code: 'ENG' });
      prisma.department.update.mockResolvedValue({
        id: '1', name: 'Engineering', code: 'ENG', organizationId: 'org-1', managerId: null, isActive: false,
      });

      const result = await service.update('org-1', 'user-1', '1', { isActive: false });

      expect(result).toHaveProperty('isActive', false);
    });

    it('should reject update with duplicate code', async () => {
      prisma.department.findFirst
        .mockResolvedValueOnce({ id: '1', name: 'Engineering', code: 'ENG' })
        .mockResolvedValueOnce({ id: '2', code: 'SALES' });

      await expect(
        service.update('org-1', 'user-1', '1', { code: 'SALES' }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.department.update).not.toHaveBeenCalled();
    });

    it('should allow updating a department to retain its own existing code', async () => {
      prisma.department.findFirst
        .mockResolvedValueOnce({ id: '1', name: 'Engineering', code: 'ENG' })
        .mockResolvedValueOnce(null);
      prisma.department.update.mockResolvedValue({
        id: '1', name: 'Engineering', code: 'ENG', organizationId: 'org-1', managerId: null, isActive: true,
      });

      const result = await service.update('org-1', 'user-1', '1', { code: 'ENG' });

      expect(result.code).toBe('ENG');
      expect(prisma.department.update).toHaveBeenCalled();
    });

    it('should scope duplicate code check to exclude current department', async () => {
      prisma.department.findFirst
        .mockResolvedValueOnce({ id: '1', name: 'Engineering', code: 'ENG' })
        .mockResolvedValueOnce(null);
      prisma.department.update.mockResolvedValue({
        id: '1', name: 'Engineering', code: 'NEW', organizationId: 'org-1', managerId: null, isActive: true,
      });

      await service.update('org-1', 'user-1', '1', { code: 'NEW' });

      expect(prisma.department.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            code: 'NEW',
            id: { not: '1' },
          }),
        }),
      );
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

  describe('manager clearing', () => {
    it('should set managerId to null when managerId is explicitly null', async () => {
      prisma.department.findFirst.mockResolvedValue({ id: '1', name: 'Engineering', code: 'ENG' });
      prisma.department.update.mockResolvedValue({
        id: '1', name: 'Engineering', code: 'ENG', organizationId: 'org-1', managerId: null, isActive: true,
      });

      await service.update('org-1', 'user-1', '1', { managerId: null });

      expect(prisma.department.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ managerId: null }),
        }),
      );
    });

    it('should not change managerId when managerId is undefined', async () => {
      prisma.department.findFirst.mockResolvedValue({ id: '1', name: 'Engineering', code: 'ENG' });
      prisma.department.update.mockResolvedValue({
        id: '1', name: 'Engineering', code: 'ENG', organizationId: 'org-1', managerId: 'existing', isActive: true,
      });

      await service.update('org-1', 'user-1', '1', { name: 'Updated' });

      const updateCall = prisma.department.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('managerId');
    });
  });

  describe('isActive update', () => {
    it('should update isActive to false', async () => {
      prisma.department.findFirst.mockResolvedValue({ id: '1', name: 'Engineering', code: 'ENG' });
      prisma.department.update.mockResolvedValue({
        id: '1', name: 'Engineering', code: 'ENG', organizationId: 'org-1', managerId: null, isActive: false,
      });

      await service.update('org-1', 'user-1', '1', { isActive: false });

      expect(prisma.department.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false }),
        }),
      );
    });

    it('should update isActive to true', async () => {
      prisma.department.findFirst.mockResolvedValue({ id: '1', name: 'Engineering', code: 'ENG' });
      prisma.department.update.mockResolvedValue({
        id: '1', name: 'Engineering', code: 'ENG', organizationId: 'org-1', managerId: null, isActive: true,
      });

      await service.update('org-1', 'user-1', '1', { isActive: true });

      expect(prisma.department.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: true }),
        }),
      );
    });
  });

  describe('findAllPaginated', () => {
    beforeEach(() => {
      prisma.department.count = jest.fn();
    });

    it('should return paginated departments with meta', async () => {
      const departments = [
        { id: '1', name: 'Engineering', code: 'ENG', organizationId: 'org-1', managerId: null, isActive: true },
        { id: '2', name: 'Sales', code: 'SALES', organizationId: 'org-1', managerId: null, isActive: true },
      ];
      prisma.department.findMany.mockResolvedValue(departments);
      prisma.department.count.mockResolvedValue(2);

      const result = await service.findAllPaginated('org-1', {});

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ total: 2, page: 1, limit: 20, totalPages: 1 });
      expect(result.data[0].shared).toBe(false);
    });

    it('should use default page 1 and limit 20', async () => {
      prisma.department.findMany.mockResolvedValue([]);
      prisma.department.count.mockResolvedValue(0);

      await service.findAllPaginated('org-1', {});

      expect(prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });

    it('should calculate skip for page 2', async () => {
      prisma.department.findMany.mockResolvedValue([]);
      prisma.department.count.mockResolvedValue(25);

      const result = await service.findAllPaginated('org-1', { page: 2, limit: 10 });

      expect(prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
      expect(result.meta.page).toBe(2);
      expect(result.meta.totalPages).toBe(3);
    });

    it('should enforce max limit of 100', async () => {
      prisma.department.findMany.mockResolvedValue([]);
      prisma.department.count.mockResolvedValue(0);

      await service.findAllPaginated('org-1', { limit: 200 });

      expect(prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('should search by name (case-insensitive)', async () => {
      prisma.department.findMany.mockResolvedValue([]);
      prisma.department.count.mockResolvedValue(0);

      await service.findAllPaginated('org-1', { search: 'engineering' });

      expect(prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                name: expect.objectContaining({ contains: 'engineering', mode: 'insensitive' }),
              }),
            ]),
          }),
        }),
      );
    });

    it('should search by code (case-insensitive)', async () => {
      prisma.department.findMany.mockResolvedValue([]);
      prisma.department.count.mockResolvedValue(0);

      await service.findAllPaginated('org-1', { search: 'eng' });

      expect(prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                code: expect.objectContaining({ contains: 'eng', mode: 'insensitive' }),
              }),
            ]),
          }),
        }),
      );
    });

    it('should sort by name asc by default', async () => {
      prisma.department.findMany.mockResolvedValue([]);
      prisma.department.count.mockResolvedValue(0);

      await service.findAllPaginated('org-1', {});

      expect(prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: 'asc' } }),
      );
    });

    it('should sort by code desc', async () => {
      prisma.department.findMany.mockResolvedValue([]);
      prisma.department.count.mockResolvedValue(0);

      await service.findAllPaginated('org-1', { sortBy: 'code', sortOrder: 'desc' });

      expect(prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { code: 'desc' } }),
      );
    });

    it('should sort by isActive', async () => {
      prisma.department.findMany.mockResolvedValue([]);
      prisma.department.count.mockResolvedValue(0);

      await service.findAllPaginated('org-1', { sortBy: 'isActive', sortOrder: 'asc' });

      expect(prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { isActive: 'asc' } }),
      );
    });

    it('should sort by createdAt', async () => {
      prisma.department.findMany.mockResolvedValue([]);
      prisma.department.count.mockResolvedValue(0);

      await service.findAllPaginated('org-1', { sortBy: 'createdAt', sortOrder: 'desc' });

      expect(prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('should scope to organization and include shared departments', async () => {
      prisma.department.findMany.mockResolvedValue([]);
      prisma.department.count.mockResolvedValue(0);

      await service.findAllPaginated('org-1', {});

      expect(prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ organizationId: 'org-1' }, { organizationId: null }],
          }),
        }),
      );
    });

    it('should return empty result set', async () => {
      prisma.department.findMany.mockResolvedValue([]);
      prisma.department.count.mockResolvedValue(0);

      const result = await service.findAllPaginated('org-1', { search: 'nonexistent' });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('should include shared flag in response', async () => {
      prisma.department.findMany.mockResolvedValue([
        { id: '1', name: 'Org Dept', code: 'ORG', organizationId: 'org-1', managerId: null, isActive: true },
        { id: '2', name: 'Shared Dept', code: 'SHR', organizationId: null, managerId: null, isActive: true },
      ]);
      prisma.department.count.mockResolvedValue(2);

      const result = await service.findAllPaginated('org-1', {});

      expect(result.data[0].shared).toBe(false);
      expect(result.data[1].shared).toBe(true);
    });

    it('should calculate totalPages correctly', async () => {
      prisma.department.findMany.mockResolvedValue([]);
      prisma.department.count.mockResolvedValue(45);

      const result = await service.findAllPaginated('org-1', { page: 1, limit: 20 });

      expect(result.meta.totalPages).toBe(3);
      expect(result.meta.total).toBe(45);
    });
  });

  describe('shared department protection', () => {
    it('should throw NotFoundException when updating shared department from different org', async () => {
      prisma.department.findFirst.mockResolvedValue(null);

      await expect(
        service.update('org-1', 'user-1', 'shared-dept', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
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
