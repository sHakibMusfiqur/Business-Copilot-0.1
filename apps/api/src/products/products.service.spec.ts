import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';

const ORG_ID = 'org-1';

const p2025 = () =>
  new Prisma.PrismaClientKnownRequestError('Record not found', {
    code: 'P2025',
    clientVersion: '6.0.0',
    meta: {},
  });

const p2002 = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6.0.0',
    meta: { target: ['organizationId', 'sku'] },
  });

const buildService = (overrides: Record<string, jest.Mock> = {}) => {
  const categoryFindFirst = overrides.categoryFindFirst ?? jest.fn();
  const supplierFindFirst = overrides.supplierFindFirst ?? jest.fn();
  const productCreate = overrides.productCreate ?? jest.fn().mockResolvedValue({ id: 'p1', name: 'Product', sku: 'SKU-1' });
  const productFindFirst = overrides.productFindFirst ?? jest.fn().mockResolvedValue({ id: 'p1', organizationId: ORG_ID });
  const productFindMany = overrides.productFindMany ?? jest.fn().mockResolvedValue([]);
  const productCount = overrides.productCount ?? jest.fn().mockResolvedValue(0);
  const productUpdate = overrides.productUpdate ?? jest.fn().mockResolvedValue({ id: 'p1', name: 'Product', sku: 'SKU-1', isActive: true, updatedAt: new Date() });

  const service = new ProductsService({
    category: { findFirst: categoryFindFirst },
    supplier: { findFirst: supplierFindFirst },
    product: {
      create: productCreate,
      findFirst: productFindFirst,
      findMany: productFindMany,
      count: productCount,
      update: productUpdate,
    },
  } as unknown as PrismaService);

  return {
    service,
    categoryFindFirst,
    supplierFindFirst,
    productCreate,
    productFindFirst,
    productFindMany,
    productCount,
    productUpdate,
  };
};

describe('ProductsService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('create - category/supplier tenant isolation', () => {
    it('rejects a category from another organization', async () => {
      const { service, categoryFindFirst, productCreate } = buildService();
      categoryFindFirst.mockResolvedValue(null);

      await expect(
        service.create(ORG_ID, 'u1', { name: 'Widget', sku: 'W-1', categoryId: 'cat-other' } as never),
      ).rejects.toThrow(BadRequestException);

      expect(productCreate).not.toHaveBeenCalled();
    });

    it('allows a category from the same organization', async () => {
      const { service, categoryFindFirst, productCreate } = buildService();
      categoryFindFirst.mockResolvedValue({ id: 'cat-own' });

      await service.create(ORG_ID, 'u1', { name: 'Widget', sku: 'W-1', categoryId: 'cat-own' } as never);

      expect(categoryFindFirst).toHaveBeenCalledWith({
        where: { id: 'cat-own', OR: [{ organizationId: ORG_ID }, { organizationId: null }] },
        select: { id: true },
      });
      expect(productCreate).toHaveBeenCalled();
    });

    it('allows an intentionally global category (organizationId null)', async () => {
      const { service, categoryFindFirst, productCreate } = buildService();
      categoryFindFirst.mockResolvedValue({ id: 'cat-global' });

      await service.create(ORG_ID, 'u1', { name: 'Widget', sku: 'W-1', categoryId: 'cat-global' } as never);

      expect(categoryFindFirst).toHaveBeenCalledWith({
        where: { id: 'cat-global', OR: [{ organizationId: ORG_ID }, { organizationId: null }] },
        select: { id: true },
      });
      expect(productCreate).toHaveBeenCalled();
    });

    it('rejects a supplier from another organization', async () => {
      const { service, supplierFindFirst, productCreate } = buildService();
      supplierFindFirst.mockResolvedValue(null);

      await expect(
        service.create(ORG_ID, 'u1', { name: 'Widget', sku: 'W-1', supplierId: 'sup-other' } as never),
      ).rejects.toThrow(BadRequestException);

      expect(productCreate).not.toHaveBeenCalled();
    });

    it('allows a supplier from the same organization', async () => {
      const { service, supplierFindFirst, productCreate } = buildService();
      supplierFindFirst.mockResolvedValue({ id: 'sup-own' });

      await service.create(ORG_ID, 'u1', { name: 'Widget', sku: 'W-1', supplierId: 'sup-own' } as never);

      expect(supplierFindFirst).toHaveBeenCalledWith({
        where: { id: 'sup-own', organizationId: ORG_ID },
        select: { id: true },
      });
      expect(productCreate).toHaveBeenCalled();
    });

    it('does not require a category or supplier reference', async () => {
      const { service, categoryFindFirst, supplierFindFirst, productCreate } = buildService();

      await service.create(ORG_ID, 'u1', { name: 'Widget', sku: 'W-1' } as never);

      expect(categoryFindFirst).not.toHaveBeenCalled();
      expect(supplierFindFirst).not.toHaveBeenCalled();
      expect(productCreate).toHaveBeenCalled();
    });

    it('throws BadRequestException on duplicate SKU (P2002)', async () => {
      const { service, productCreate } = buildService();
      productCreate.mockRejectedValue(p2002());

      await expect(
        service.create(ORG_ID, 'u1', { name: 'Widget', sku: 'W-1' } as never),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update - category/supplier tenant isolation', () => {
    it('rejects changing categoryId to another organization category', async () => {
      const { service, productFindFirst, categoryFindFirst } = buildService();
      productFindFirst.mockResolvedValue({ id: 'p1', organizationId: ORG_ID });
      categoryFindFirst.mockResolvedValue(null);

      await expect(
        service.update(ORG_ID, 'u1', 'p1', { categoryId: 'cat-other' } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows changing categoryId to the same organization category', async () => {
      const { service, productFindFirst, categoryFindFirst, productUpdate } = buildService();
      productFindFirst.mockResolvedValue({ id: 'p1', organizationId: ORG_ID });
      categoryFindFirst.mockResolvedValue({ id: 'cat-own' });

      await service.update(ORG_ID, 'u1', 'p1', { categoryId: 'cat-own' } as never);

      expect(productUpdate).toHaveBeenCalled();
    });

    it('rejects changing supplierId to another organization supplier', async () => {
      const { service, productFindFirst, supplierFindFirst } = buildService();
      productFindFirst.mockResolvedValue({ id: 'p1', organizationId: ORG_ID });
      supplierFindFirst.mockResolvedValue(null);

      await expect(
        service.update(ORG_ID, 'u1', 'p1', { supplierId: 'sup-other' } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows changing supplierId to the same organization supplier', async () => {
      const { service, productFindFirst, supplierFindFirst, productUpdate } = buildService();
      productFindFirst.mockResolvedValue({ id: 'p1', organizationId: ORG_ID });
      supplierFindFirst.mockResolvedValue({ id: 'sup-own' });

      await service.update(ORG_ID, 'u1', 'p1', { supplierId: 'sup-own' } as never);

      expect(productUpdate).toHaveBeenCalled();
    });

    it('allows clearing categoryId/supplierId without validation', async () => {
      const { service, productFindFirst, categoryFindFirst, supplierFindFirst, productUpdate } = buildService();
      productFindFirst.mockResolvedValue({ id: 'p1', organizationId: ORG_ID });

      await service.update(ORG_ID, 'u1', 'p1', { categoryId: null, supplierId: null } as never);

      expect(categoryFindFirst).not.toHaveBeenCalled();
      expect(supplierFindFirst).not.toHaveBeenCalled();
      expect(productUpdate).toHaveBeenCalled();
    });

    it('rejects a cross-tenant category on an update to another organization product', async () => {
      const { service, productFindFirst } = buildService();
      productFindFirst.mockResolvedValue(null);

      await expect(
        service.update(ORG_ID, 'u1', 'p1', { categoryId: 'cat-other' } as never),
      ).rejects.toThrow();
    });

    it('throws BadRequestException on duplicate SKU during update (P2002)', async () => {
      const { service, productFindFirst, productUpdate } = buildService();
      productFindFirst.mockResolvedValue({ id: 'p1', organizationId: ORG_ID });
      productUpdate.mockRejectedValue(p2002());

      await expect(
        service.update(ORG_ID, 'u1', 'p1', { sku: 'DUPLICATE-SKU' } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when updating non-existent product (P2025)', async () => {
      const { service, productFindFirst, productUpdate } = buildService();
      productFindFirst.mockResolvedValue({ id: 'p1', organizationId: ORG_ID });
      productUpdate.mockRejectedValue(p2025());

      await expect(
        service.update(ORG_ID, 'u1', 'p1', { name: 'Updated' } as never),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus - tenant scoping (P1 fix)', () => {
    it('succeeds for a product in the same organization', async () => {
      const { service, productUpdate } = buildService();
      productUpdate.mockResolvedValue({ id: 'p1', name: 'Widget', sku: 'SKU-1', isActive: false, updatedAt: new Date() });

      const result = await service.updateStatus(ORG_ID, 'u1', 'p1', { isActive: false });

      expect(productUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p1', organizationId: ORG_ID },
          data: { isActive: false },
        }),
      );
      expect(result.isActive).toBe(false);
    });

    it('rejects a product from another organization (P2025)', async () => {
      const { service, productUpdate } = buildService();
      productUpdate.mockRejectedValue(p2025());

      await expect(
        service.updateStatus(ORG_ID, 'u1', 'p-other', { isActive: true }),
      ).rejects.toThrow(NotFoundException);
    });

    it('uses atomic org-scoped update (not findFirst + separate update)', async () => {
      const { service, productUpdate } = buildService();
      productUpdate.mockResolvedValue({ id: 'p1', name: 'Widget', sku: 'SKU-1', isActive: true, updatedAt: new Date() });

      await service.updateStatus(ORG_ID, 'u1', 'p1', { isActive: true });

      // Verify the update uses organizationId in the where clause
      const updateCall = productUpdate.mock.calls[0][0];
      expect(updateCall.where).toEqual({ id: 'p1', organizationId: ORG_ID });
    });
  });

  describe('softDelete - tenant scoping', () => {
    it('succeeds for a product in the same organization', async () => {
      const { service, productUpdate } = buildService();
      productUpdate.mockResolvedValue({ id: 'p1', name: 'Widget' });

      const result = await service.softDelete(ORG_ID, 'u1', 'p1');

      expect(productUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p1', organizationId: ORG_ID, deletedAt: null },
          data: { deletedAt: expect.any(Date), isActive: false },
        }),
      );
      expect(result.message).toContain('deleted');
    });

    it('rejects a product from another organization', async () => {
      const { service, productUpdate } = buildService();
      productUpdate.mockRejectedValue(p2025());

      await expect(service.softDelete(ORG_ID, 'u1', 'p-other')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll - pagination and search', () => {
    it('returns paginated results with meta', async () => {
      const { service, productCount, productFindMany } = buildService();
      productCount.mockResolvedValue(25);
      productFindMany.mockResolvedValue([
        { id: 'p1', name: 'Widget', sku: 'W-1', inventory: [], isActive: true, createdAt: new Date(), updatedAt: new Date() },
      ]);

      const result = await service.findAll(ORG_ID, { page: 2, limit: 10 });

      expect(result.meta).toEqual({ total: 25, page: 2, limit: 10, totalPages: 3 });
      expect(result.data).toHaveLength(1);
      expect(productFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('applies search filter with OR on name/sku/barcode/brand', async () => {
      const { service, productFindMany } = buildService();
      productFindMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, { search: 'widget' });

      const whereArg = productFindMany.mock.calls[0][0].where;
      expect(whereArg.OR).toEqual([
        { name: { contains: 'widget', mode: 'insensitive' } },
        { sku: { contains: 'widget', mode: 'insensitive' } },
        { barcode: { contains: 'widget', mode: 'insensitive' } },
        { brand: { contains: 'widget', mode: 'insensitive' } },
      ]);
    });

    it('always includes organizationId in where clause', async () => {
      const { service, productFindMany } = buildService();
      productFindMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, {});

      const whereArg = productFindMany.mock.calls[0][0].where;
      expect(whereArg.organizationId).toBe(ORG_ID);
      expect(whereArg.deletedAt).toBeNull();
    });

    it('applies isActive filter', async () => {
      const { service, productFindMany } = buildService();
      productFindMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, { isActive: false });

      const whereArg = productFindMany.mock.calls[0][0].where;
      expect(whereArg.isActive).toBe(false);
    });

    it('applies categoryId filter', async () => {
      const { service, productFindMany } = buildService();
      productFindMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, { categoryId: 'cat-1' });

      const whereArg = productFindMany.mock.calls[0][0].where;
      expect(whereArg.categoryId).toBe('cat-1');
    });

    it('uses allowed sort fields', async () => {
      const { service, productFindMany } = buildService();
      productFindMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, { sortBy: 'name', sortOrder: 'asc' });

      expect(productFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: 'asc' } }),
      );
    });

    it('falls back to createdAt for disallowed sort field', async () => {
      const { service, productFindMany } = buildService();
      productFindMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, { sortBy: 'evilField', sortOrder: 'desc' });

      expect(productFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });
  });
});
