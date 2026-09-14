import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { SuppliersService } from './suppliers.service';
import { PrismaService } from '../prisma/prisma.service';

const ORG_ID = 'org-1';
const OTHER_ORG = 'org-2';

const p2025 = () =>
  new Prisma.PrismaClientKnownRequestError('Record not found', {
    code: 'P2025',
    clientVersion: '6.0.0',
    meta: {},
  });

const buildService = (overrides: Record<string, jest.Mock> = {}) => {
  const supplierFindMany = overrides.supplierFindMany ?? jest.fn().mockResolvedValue([]);
  const supplierCount = overrides.supplierCount ?? jest.fn().mockResolvedValue(0);
  const supplierFindFirst = overrides.supplierFindFirst ?? jest.fn();
  const supplierCreate = overrides.supplierCreate ?? jest.fn();
  const supplierUpdate = overrides.supplierUpdate ?? jest.fn();
  const supplierUpdateMany = overrides.supplierUpdateMany ?? jest.fn();

  const service = new SuppliersService({
    supplier: {
      findMany: supplierFindMany,
      count: supplierCount,
      findFirst: supplierFindFirst,
      create: supplierCreate,
      update: supplierUpdate,
      updateMany: supplierUpdateMany,
    },
  } as unknown as PrismaService);

  return {
    service,
    supplierFindMany,
    supplierCount,
    supplierFindFirst,
    supplierCreate,
    supplierUpdate,
    supplierUpdateMany,
  };
};

describe('SuppliersService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('findAll - pagination and search', () => {
    it('returns paginated results with meta', async () => {
      const { service, supplierCount, supplierFindMany } = buildService();
      supplierCount.mockResolvedValue(25);
      supplierFindMany.mockResolvedValue([
        { id: 's1', name: 'Vendor', email: 'vendor@test.com', isActive: true, createdAt: new Date(), updatedAt: new Date() },
      ]);

      const result = await service.findAll(ORG_ID, { page: 2, limit: 10 });

      expect(result.meta).toEqual({ total: 25, page: 2, limit: 10, totalPages: 3 });
      expect(result.data).toHaveLength(1);
      expect(supplierFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('applies search filter with OR on name/email/phone/company', async () => {
      const { service, supplierFindMany } = buildService();
      supplierFindMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, { search: 'vendor' });

      const whereArg = supplierFindMany.mock.calls[0][0].where;
      expect(whereArg.OR).toEqual([
        { name: { contains: 'vendor', mode: 'insensitive' } },
        { email: { contains: 'vendor', mode: 'insensitive' } },
        { phone: { contains: 'vendor', mode: 'insensitive' } },
        { company: { contains: 'vendor', mode: 'insensitive' } },
      ]);
    });

    it('always includes organizationId in where clause', async () => {
      const { service, supplierFindMany } = buildService();
      supplierFindMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, {});

      const whereArg = supplierFindMany.mock.calls[0][0].where;
      expect(whereArg.organizationId).toBe(ORG_ID);
      expect(whereArg.deletedAt).toBeNull();
    });

    it('applies isActive filter', async () => {
      const { service, supplierFindMany } = buildService();
      supplierFindMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, { isActive: false });

      const whereArg = supplierFindMany.mock.calls[0][0].where;
      expect(whereArg.isActive).toBe(false);
    });

    it('applies sorting with allowed fields', async () => {
      const { service, supplierFindMany } = buildService();
      supplierFindMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, { sortBy: 'name', sortOrder: 'asc' });

      expect(supplierFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: 'asc' } }),
      );
    });

    it('falls back to createdAt for disallowed sort field', async () => {
      const { service, supplierFindMany } = buildService();
      supplierFindMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, { sortBy: 'evilField', sortOrder: 'desc' });

      expect(supplierFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('search is sanitized (trimmed)', async () => {
      const { service, supplierFindMany } = buildService();
      supplierFindMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, { search: '  vendor  ' });

      const whereArg = supplierFindMany.mock.calls[0][0].where;
      expect(whereArg.OR[0]).toEqual({ name: { contains: 'vendor', mode: 'insensitive' } });
    });

    it('does not include OR when search is empty', async () => {
      const { service, supplierFindMany } = buildService();
      supplierFindMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, {});

      const whereArg = supplierFindMany.mock.calls[0][0].where;
      expect(whereArg.OR).toBeUndefined();
    });
  });

  describe('findById', () => {
    it('returns a supplier in the same organization', async () => {
      const { service, supplierFindFirst } = buildService();
      const mockSupplier = { id: 's1', name: 'Vendor', email: 'vendor@test.com' };
      supplierFindFirst.mockResolvedValue(mockSupplier);

      const result = await service.findById(ORG_ID, 's1');

      expect(result).toEqual(mockSupplier);
      expect(supplierFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 's1', organizationId: ORG_ID, deletedAt: null },
        }),
      );
    });

    it('throws NotFoundException for non-existent supplier', async () => {
      const { service, supplierFindFirst } = buildService();
      supplierFindFirst.mockResolvedValue(null);

      await expect(service.findById(ORG_ID, 's-nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('trims and normalizes fields', async () => {
      const { service, supplierCreate } = buildService();
      supplierCreate.mockResolvedValue({ id: 's1', name: 'Vendor Co', email: 'vendor@test.com', isActive: true, createdAt: new Date() });

      await service.create(ORG_ID, 'u1', {
        name: '  Vendor Co  ',
        email: '  VENDOR@TEST.COM  ',
        phone: '  555-0200  ',
        company: '  Vendor Inc  ',
      } as never);

      expect(supplierCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Vendor Co',
            email: 'vendor@test.com',
            phone: '555-0200',
            company: 'Vendor Inc',
          }),
        }),
      );
    });

    it('connects to the correct organization', async () => {
      const { service, supplierCreate } = buildService();
      supplierCreate.mockResolvedValue({ id: 's1', name: 'Vendor', isActive: true, createdAt: new Date() });

      await service.create(ORG_ID, 'u1', { name: 'Vendor' } as never);

      const createCall = supplierCreate.mock.calls[0][0];
      expect(createCall.data.organization).toEqual({ connect: { id: ORG_ID } });
    });

    it('defaults isActive to true', async () => {
      const { service, supplierCreate } = buildService();
      supplierCreate.mockResolvedValue({ id: 's1', name: 'Vendor', isActive: true, createdAt: new Date() });

      await service.create(ORG_ID, 'u1', { name: 'Vendor' } as never);

      const createCall = supplierCreate.mock.calls[0][0];
      expect(createCall.data.isActive).toBe(true);
    });
  });

  describe('update - tenant scoping', () => {
    it('succeeds for a supplier in the same organization', async () => {
      const { service, supplierUpdate } = buildService();
      supplierUpdate.mockResolvedValue({ id: 's1', name: 'Vendor', isActive: true, updatedAt: new Date() });

      const result = await service.update(ORG_ID, 'u1', 's1', { name: 'Vendor' } as never);

      expect(supplierUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 's1', organizationId: ORG_ID, deletedAt: null },
          data: expect.objectContaining({ name: 'Vendor' }),
        }),
      );
      expect(result.name).toBe('Vendor');
    });

    it('rejects a supplier from another organization', async () => {
      const { service, supplierUpdate } = buildService();
      supplierUpdate.mockRejectedValue(p2025());

      await expect(service.update(ORG_ID, 'u1', 's-other', { name: 'X' } as never)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('trims and normalizes fields on update', async () => {
      const { service, supplierUpdate } = buildService();
      supplierUpdate.mockResolvedValue({ id: 's1', name: 'Vendor', email: 'vendor@test.com', isActive: true, updatedAt: new Date() });

      await service.update(ORG_ID, 'u1', 's1', {
        name: '  Vendor Co  ',
        email: '  VENDOR@TEST.COM  ',
      } as never);

      expect(supplierUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Vendor Co',
            email: 'vendor@test.com',
          }),
        }),
      );
    });
  });

  describe('softDelete - tenant scoping', () => {
    it('succeeds for a supplier in the same organization', async () => {
      const { service, supplierUpdateMany } = buildService();
      supplierUpdateMany.mockResolvedValue({ count: 1 });

      const result = await service.softDelete(ORG_ID, 'u1', 's1');

      expect(supplierUpdateMany).toHaveBeenCalledWith({
        where: { id: 's1', organizationId: ORG_ID, deletedAt: null },
        data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }),
      });
      expect(result.message).toContain('deleted');
    });

    it('rejects a supplier from another organization', async () => {
      const { service, supplierUpdateMany } = buildService();
      supplierUpdateMany.mockResolvedValue({ count: 0 });

      await expect(service.softDelete(ORG_ID, 'u1', 's-other')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus - tenant scoping', () => {
    it('succeeds for a supplier in the same organization', async () => {
      const { service, supplierUpdate } = buildService();
      supplierUpdate.mockResolvedValue({ id: 's1', name: 'Vendor', isActive: false, updatedAt: new Date() });

      const result = await service.updateStatus(ORG_ID, 'u1', 's1', { isActive: false } as never);

      expect(supplierUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 's1', organizationId: ORG_ID, deletedAt: null },
          data: { isActive: false },
        }),
      );
      expect(result.isActive).toBe(false);
    });

    it('rejects a supplier from another organization', async () => {
      const { service, supplierUpdate } = buildService();
      supplierUpdate.mockRejectedValue(p2025());

      await expect(
        service.updateStatus(ORG_ID, 'u1', 's-other', { isActive: true } as never),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('tenant isolation', () => {
    it('never exposes suppliers from other organizations in findAll', async () => {
      const { service, supplierFindMany } = buildService();
      supplierFindMany.mockResolvedValue([{ id: 's1', name: 'Org1 Supplier' }]);

      await service.findAll(ORG_ID, {});

      const whereArg = supplierFindMany.mock.calls[0][0].where;
      expect(whereArg.organizationId).toBe(ORG_ID);
      expect(whereArg.organizationId).not.toBe(OTHER_ORG);
    });

    it('never allows update of supplier from another org', async () => {
      const { service, supplierUpdate } = buildService();
      supplierUpdate.mockRejectedValue(p2025());

      await expect(service.update(ORG_ID, 'u1', 's-other', { name: 'Hacked' } as never)).rejects.toThrow();
    });
  });
});
