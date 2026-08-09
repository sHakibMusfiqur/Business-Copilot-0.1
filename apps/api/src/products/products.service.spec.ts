import { BadRequestException } from '@nestjs/common';

import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';

const ORG_ID = 'org-1';

describe('ProductsService (category/supplier tenant isolation)', () => {
  let service: ProductsService;
  let categoryFindFirst: jest.Mock;
  let supplierFindFirst: jest.Mock;
  let productCreate: jest.Mock;
  let productFindFirst: jest.Mock;
  let productUpdate: jest.Mock;

  beforeEach(() => {
    categoryFindFirst = jest.fn();
    supplierFindFirst = jest.fn();
    productCreate = jest.fn().mockResolvedValue({ id: 'p1', name: 'Product' });
    productFindFirst = jest.fn().mockResolvedValue({ id: 'p1', organizationId: ORG_ID });
    productUpdate = jest.fn().mockResolvedValue({ id: 'p1', name: 'Product' });

    service = new ProductsService({
      category: { findFirst: categoryFindFirst },
      supplier: { findFirst: supplierFindFirst },
      product: { create: productCreate, findFirst: productFindFirst, update: productUpdate },
    } as unknown as PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createDto = (extra: Record<string, unknown> = {}) => ({ name: 'Widget', sku: 'W-1', ...extra });

  describe('create', () => {
    it('rejects a category from another organization', async () => {
      categoryFindFirst.mockResolvedValue(null);

      await expect(
        service.create(ORG_ID, 'u1', createDto({ categoryId: 'cat-other' }) as never),
      ).rejects.toThrow(BadRequestException);

      expect(productCreate).not.toHaveBeenCalled();
    });

    it('allows a category from the same organization', async () => {
      categoryFindFirst.mockResolvedValue({ id: 'cat-own' });

      await service.create(ORG_ID, 'u1', createDto({ categoryId: 'cat-own' }) as never);

      expect(categoryFindFirst).toHaveBeenCalledWith({
        where: { id: 'cat-own', OR: [{ organizationId: ORG_ID }, { organizationId: null }] },
        select: { id: true },
      });
      expect(productCreate).toHaveBeenCalled();
    });

    it('allows an intentionally global category (organizationId null)', async () => {
      categoryFindFirst.mockResolvedValue({ id: 'cat-global' });

      await service.create(ORG_ID, 'u1', createDto({ categoryId: 'cat-global' }) as never);

      expect(categoryFindFirst).toHaveBeenCalledWith({
        where: { id: 'cat-global', OR: [{ organizationId: ORG_ID }, { organizationId: null }] },
        select: { id: true },
      });
      expect(productCreate).toHaveBeenCalled();
    });

    it('rejects a supplier from another organization', async () => {
      supplierFindFirst.mockResolvedValue(null);

      await expect(
        service.create(ORG_ID, 'u1', createDto({ supplierId: 'sup-other' }) as never),
      ).rejects.toThrow(BadRequestException);

      expect(productCreate).not.toHaveBeenCalled();
    });

    it('allows a supplier from the same organization', async () => {
      supplierFindFirst.mockResolvedValue({ id: 'sup-own' });

      await service.create(ORG_ID, 'u1', createDto({ supplierId: 'sup-own' }) as never);

      expect(supplierFindFirst).toHaveBeenCalledWith({
        where: { id: 'sup-own', organizationId: ORG_ID },
        select: { id: true },
      });
      expect(productCreate).toHaveBeenCalled();
    });

    it('does not require a category or supplier reference', async () => {
      await service.create(ORG_ID, 'u1', createDto() as never);

      expect(categoryFindFirst).not.toHaveBeenCalled();
      expect(supplierFindFirst).not.toHaveBeenCalled();
      expect(productCreate).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('rejects changing categoryId to another organization category', async () => {
      productFindFirst.mockResolvedValue({ id: 'p1', organizationId: ORG_ID });
      categoryFindFirst.mockResolvedValue(null);

      await expect(
        service.update(ORG_ID, 'u1', 'p1', { categoryId: 'cat-other' } as never),
      ).rejects.toThrow(BadRequestException);

      expect(productUpdate).not.toHaveBeenCalled();
    });

    it('allows changing categoryId to the same organization category', async () => {
      productFindFirst.mockResolvedValue({ id: 'p1', organizationId: ORG_ID });
      categoryFindFirst.mockResolvedValue({ id: 'cat-own' });

      await service.update(ORG_ID, 'u1', 'p1', { categoryId: 'cat-own' } as never);

      expect(productUpdate).toHaveBeenCalled();
    });

    it('rejects changing supplierId to another organization supplier', async () => {
      productFindFirst.mockResolvedValue({ id: 'p1', organizationId: ORG_ID });
      supplierFindFirst.mockResolvedValue(null);

      await expect(
        service.update(ORG_ID, 'u1', 'p1', { supplierId: 'sup-other' } as never),
      ).rejects.toThrow(BadRequestException);

      expect(productUpdate).not.toHaveBeenCalled();
    });

    it('allows changing supplierId to the same organization supplier', async () => {
      productFindFirst.mockResolvedValue({ id: 'p1', organizationId: ORG_ID });
      supplierFindFirst.mockResolvedValue({ id: 'sup-own' });

      await service.update(ORG_ID, 'u1', 'p1', { supplierId: 'sup-own' } as never);

      expect(productUpdate).toHaveBeenCalled();
    });

    it('allows clearing categoryId/supplierId without validation', async () => {
      productFindFirst.mockResolvedValue({ id: 'p1', organizationId: ORG_ID });

      await service.update(ORG_ID, 'u1', 'p1', { categoryId: null, supplierId: null } as never);

      expect(categoryFindFirst).not.toHaveBeenCalled();
      expect(supplierFindFirst).not.toHaveBeenCalled();
      expect(productUpdate).toHaveBeenCalled();
    });

    it('rejects a cross-tenant category on an update to another organization product', async () => {
      productFindFirst.mockResolvedValue(null);

      await expect(
        service.update(ORG_ID, 'u1', 'p1', { categoryId: 'cat-other' } as never),
      ).rejects.toThrow();

      expect(categoryFindFirst).not.toHaveBeenCalled();
      expect(productUpdate).not.toHaveBeenCalled();
    });
  });
});