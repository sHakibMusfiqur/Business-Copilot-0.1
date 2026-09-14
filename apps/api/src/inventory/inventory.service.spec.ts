import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TransactionType } from '@prisma/client';

import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';

const ORG_ID = 'org-1';
const OTHER_ORG = 'org-2';
const USER_ID = 'user-1';
const PRODUCT_ID = 'prod-1';

describe('InventoryService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('findAll - pagination and search', () => {
    const buildService = (overrides: Record<string, jest.Mock> = {}) => {
      const productFindMany = overrides.productFindMany ?? jest.fn().mockResolvedValue([]);
      const productCount = overrides.productCount ?? jest.fn().mockResolvedValue(0);

      const service = new InventoryService({
        product: { findMany: productFindMany, count: productCount },
        $transaction: jest.fn(),
      } as unknown as PrismaService, {
        record: jest.fn(),
      } as never);

      return { service, productFindMany, productCount };
    };

    it('returns paginated results with meta', async () => {
      const { service, productCount, productFindMany } = buildService();
      productCount.mockResolvedValue(25);
      productFindMany.mockResolvedValue([
        {
          id: 'p1', name: 'Widget', sku: 'W-1', minimumStock: 5, maximumStock: 100,
          unitPrice: 10, costPrice: 5, isActive: true, updatedAt: new Date(),
          categoryId: null, category: null, supplierId: null, supplier: null,
          inventory: [{ quantity: 10 }],
        },
      ]);

      const result = await service.findAll(ORG_ID, { page: 2, limit: 10 });

      expect(result.meta).toEqual({ total: 25, page: 2, limit: 10, totalPages: 3 });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].currentStock).toBe(10);
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

    it('applies sorting with allowed fields', async () => {
      const { service, productFindMany } = buildService();
      productFindMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, { sortBy: 'name', sortOrder: 'asc' });

      expect(productFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: 'asc' } }),
      );
    });

    it('falls back to updatedAt for disallowed sort field', async () => {
      const { service, productFindMany } = buildService();
      productFindMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, { sortBy: 'evilField', sortOrder: 'desc' });

      expect(productFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { updatedAt: 'desc' } }),
      );
    });

    it('search is sanitized (trimmed)', async () => {
      const { service, productFindMany } = buildService();
      productFindMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, { search: '  widget  ' });

      const whereArg = productFindMany.mock.calls[0][0].where;
      expect(whereArg.OR[0]).toEqual({ name: { contains: 'widget', mode: 'insensitive' } });
    });

    it('does not include OR when search is empty', async () => {
      const { service, productFindMany } = buildService();
      productFindMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, {});

      const whereArg = productFindMany.mock.calls[0][0].where;
      expect(whereArg.OR).toBeUndefined();
    });

    it('computes currentStock from inventory array', async () => {
      const { service, productFindMany } = buildService();
      productFindMany.mockResolvedValue([
        {
          id: 'p1', name: 'Widget', sku: 'W-1', minimumStock: 5, maximumStock: 100,
          unitPrice: 10, costPrice: 5, isActive: true, updatedAt: new Date(),
          categoryId: null, category: null, supplierId: null, supplier: null,
          inventory: [{ quantity: 3 }, { quantity: 7 }],
        },
      ]);

      const result = await service.findAll(ORG_ID, {});

      expect(result.data[0].currentStock).toBe(10);
    });

    it('handles products with no inventory rows', async () => {
      const { service, productFindMany } = buildService();
      productFindMany.mockResolvedValue([
        {
          id: 'p1', name: 'Widget', sku: 'W-1', minimumStock: 5, maximumStock: 100,
          unitPrice: 10, costPrice: 5, isActive: true, updatedAt: new Date(),
          categoryId: null, category: null, supplierId: null, supplier: null,
          inventory: [],
        },
      ]);

      const result = await service.findAll(ORG_ID, {});

      expect(result.data[0].currentStock).toBe(0);
    });

    it('never exposes products from other organizations', async () => {
      const { service, productFindMany } = buildService();
      productFindMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, {});

      const whereArg = productFindMany.mock.calls[0][0].where;
      expect(whereArg.organizationId).toBe(ORG_ID);
      expect(whereArg.organizationId).not.toBe(OTHER_ORG);
    });
  });

  describe('adjust - stock mutation', () => {
    let service: InventoryService;
    let productFindFirst: jest.Mock;
    let inventoryFindUnique: jest.Mock;
    let inventoryUpdate: jest.Mock;
    let inventoryUpdateMany: jest.Mock;
    let inventoryCreate: jest.Mock;
    let inventoryTransactionCreate: jest.Mock;
    let transaction: jest.Mock;
    let queryRaw: jest.Mock;

    beforeEach(() => {
      productFindFirst = jest.fn().mockResolvedValue({ id: PRODUCT_ID, name: 'Widget', sku: 'W-1' });
      inventoryFindUnique = jest.fn();
      inventoryUpdate = jest.fn().mockResolvedValue({});
      inventoryUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
      inventoryCreate = jest.fn().mockResolvedValue({});
      inventoryTransactionCreate = jest.fn().mockResolvedValue({});
      queryRaw = jest.fn().mockResolvedValue([]);

      const mockTx = {
        inventory: {
          findUnique: inventoryFindUnique,
          update: inventoryUpdate,
          updateMany: inventoryUpdateMany,
          create: inventoryCreate,
        },
        inventoryTransaction: { create: inventoryTransactionCreate },
        $queryRaw: queryRaw,
      };

      transaction = jest.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx));

      service = new InventoryService({
        product: { findFirst: productFindFirst },
        $transaction: transaction,
      } as unknown as PrismaService, {
        record: jest.fn().mockResolvedValue(undefined),
      } as never);
    });

    const outDto = (quantity = 6, notes?: string) => ({
      productId: PRODUCT_ID,
      type: TransactionType.OUT,
      quantity,
      notes,
    });

    const inDto = (quantity = 5, notes?: string) => ({
      productId: PRODUCT_ID,
      type: TransactionType.IN,
      quantity,
      notes,
    });

    const adjustDto = (quantity = 100, notes?: string) => ({
      productId: PRODUCT_ID,
      type: TransactionType.ADJUSTMENT,
      quantity,
      notes,
    });

    it('OUT succeeds when sufficient stock exists', async () => {
      queryRaw.mockResolvedValue([{ id: 'inv-1', quantity: 10 }]);
      inventoryFindUnique.mockResolvedValue({ id: 'inv-1', quantity: 4 });

      const result = await service.adjust(ORG_ID, USER_ID, outDto(6));

      expect(inventoryUpdateMany).toHaveBeenCalledWith({
        where: { id: 'inv-1', quantity: { gte: 6 } },
        data: { quantity: { decrement: 6 } },
      });
      expect(result.previousQuantity).toBe(10);
      expect(result.newQuantity).toBe(4);
    });

    it('OUT fails when insufficient stock', async () => {
      queryRaw.mockResolvedValue([{ id: 'inv-1', quantity: 3 }]);
      inventoryUpdateMany.mockResolvedValue({ count: 0 });
      inventoryFindUnique.mockResolvedValue({ id: 'inv-1', quantity: 3 });

      await expect(service.adjust(ORG_ID, USER_ID, outDto(6))).rejects.toThrow(BadRequestException);
      expect(inventoryTransactionCreate).not.toHaveBeenCalled();
    });

    it('OUT fails when no inventory row exists', async () => {
      queryRaw.mockResolvedValue([]);

      await expect(service.adjust(ORG_ID, USER_ID, outDto(6))).rejects.toThrow(BadRequestException);
    });

    it('IN succeeds with existing inventory row using atomic increment', async () => {
      queryRaw.mockResolvedValue([{ id: 'inv-1', quantity: 10 }]);
      inventoryFindUnique.mockResolvedValue({ id: 'inv-1', quantity: 15 });

      const result = await service.adjust(ORG_ID, USER_ID, inDto(5));

      expect(inventoryUpdateMany).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { quantity: { increment: 5 } },
      });
      expect(result.previousQuantity).toBe(10);
      expect(result.newQuantity).toBe(15);
    });

    it('IN creates inventory row when no row exists', async () => {
      queryRaw.mockResolvedValue([]);

      const result = await service.adjust(ORG_ID, USER_ID, inDto(5));

      expect(inventoryCreate).toHaveBeenCalledWith({
        data: { organizationId: ORG_ID, productId: PRODUCT_ID, quantity: 5 },
      });
      expect(result.previousQuantity).toBe(0);
      expect(result.newQuantity).toBe(5);
    });

    it('ADJUSTMENT sets absolute value with existing inventory', async () => {
      queryRaw.mockResolvedValue([{ id: 'inv-1', quantity: 50 }]);

      const result = await service.adjust(ORG_ID, USER_ID, adjustDto(100));

      expect(inventoryUpdate).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { quantity: 100 },
      });
      expect(result.previousQuantity).toBe(50);
      expect(result.newQuantity).toBe(100);
    });

    it('ADJUSTMENT creates inventory row when no row exists', async () => {
      queryRaw.mockResolvedValue([]);

      const result = await service.adjust(ORG_ID, USER_ID, adjustDto(100));

      expect(inventoryCreate).toHaveBeenCalledWith({
        data: { organizationId: ORG_ID, productId: PRODUCT_ID, quantity: 100 },
      });
      expect(result.previousQuantity).toBe(0);
      expect(result.newQuantity).toBe(100);
    });

    it('rejects product from another organization', async () => {
      productFindFirst.mockResolvedValue(null);

      await expect(service.adjust(ORG_ID, USER_ID, outDto(6))).rejects.toThrow(NotFoundException);
      expect(queryRaw).not.toHaveBeenCalled();
    });

    it('records inventory transaction with correct data', async () => {
      queryRaw.mockResolvedValue([{ id: 'inv-1', quantity: 10 }]);
      inventoryFindUnique.mockResolvedValue({ id: 'inv-1', quantity: 4 });

      await service.adjust(ORG_ID, USER_ID, outDto(6, 'test note'));

      expect(inventoryTransactionCreate).toHaveBeenCalledWith({
        data: {
          organizationId: ORG_ID,
          productId: PRODUCT_ID,
          type: TransactionType.OUT,
          quantity: 6,
          previousQuantity: 10,
          newQuantity: 4,
          notes: 'test note',
          createdById: USER_ID,
        },
      });
    });

    it('uses SELECT ... FOR UPDATE via $queryRaw', async () => {
      queryRaw.mockResolvedValue([{ id: 'inv-1', quantity: 10 }]);
      inventoryFindUnique.mockResolvedValue({ id: 'inv-1', quantity: 4 });

      await service.adjust(ORG_ID, USER_ID, outDto(6));

      expect(queryRaw).toHaveBeenCalled();
    });

    it('uses atomic updateMany for OUT (not read-modify-write)', async () => {
      queryRaw.mockResolvedValue([{ id: 'inv-1', quantity: 10 }]);
      inventoryFindUnique.mockResolvedValue({ id: 'inv-1', quantity: 4 });

      await service.adjust(ORG_ID, USER_ID, outDto(6));

      expect(inventoryUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ quantity: { gte: 6 } }),
        }),
      );
      expect(inventoryUpdate).not.toHaveBeenCalled();
    });

    it('uses atomic updateMany for IN (not read-modify-write)', async () => {
      queryRaw.mockResolvedValue([{ id: 'inv-1', quantity: 10 }]);
      inventoryFindUnique.mockResolvedValue({ id: 'inv-1', quantity: 15 });

      await service.adjust(ORG_ID, USER_ID, inDto(5));

      expect(inventoryUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ quantity: { increment: 5 } }),
        }),
      );
    });

    it('throws on invalid transaction type', async () => {
      queryRaw.mockResolvedValue([{ id: 'inv-1', quantity: 10 }]);

      await expect(
        service.adjust(ORG_ID, USER_ID, { productId: PRODUCT_ID, type: 'INVALID' as TransactionType, quantity: 5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('does not record history on failed OUT', async () => {
      queryRaw.mockResolvedValue([{ id: 'inv-1', quantity: 3 }]);
      inventoryUpdateMany.mockResolvedValue({ count: 0 });
      inventoryFindUnique.mockResolvedValue({ id: 'inv-1', quantity: 3 });

      await expect(service.adjust(ORG_ID, USER_ID, outDto(6))).rejects.toThrow();
      expect(inventoryTransactionCreate).not.toHaveBeenCalled();
    });
  });

  describe('getHistory', () => {
    it('returns transactions for a product in the same organization', async () => {
      const productFindFirst = jest.fn().mockResolvedValue({ id: PRODUCT_ID });
      const findMany = jest.fn().mockResolvedValue([
        { id: 'tx1', type: 'IN', quantity: 5, previousQuantity: 0, newQuantity: 5, reference: null, notes: null, createdAt: new Date(), createdBy: { id: 'u1', name: 'Admin' } },
      ]);

      const service = new InventoryService({
        product: { findFirst: productFindFirst },
        inventoryTransaction: { findMany },
      } as unknown as PrismaService, {
        record: jest.fn(),
      } as never);

      const result = await service.getHistory(ORG_ID, PRODUCT_ID);

      expect(result).toHaveLength(1);
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId: PRODUCT_ID, organizationId: ORG_ID },
        }),
      );
    });

    it('throws NotFoundException for non-existent product', async () => {
      const productFindFirst = jest.fn().mockResolvedValue(null);

      const service = new InventoryService({
        product: { findFirst: productFindFirst },
      } as unknown as PrismaService, {
        record: jest.fn(),
      } as never);

      await expect(service.getHistory(ORG_ID, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('never leaks transactions from other organizations', async () => {
      const productFindFirst = jest.fn().mockResolvedValue({ id: PRODUCT_ID });
      const findMany = jest.fn().mockResolvedValue([]);

      const service = new InventoryService({
        product: { findFirst: productFindFirst },
        inventoryTransaction: { findMany },
      } as unknown as PrismaService, {
        record: jest.fn(),
      } as never);

      await service.getHistory(ORG_ID, PRODUCT_ID);

      const whereArg = findMany.mock.calls[0][0].where;
      expect(whereArg.organizationId).toBe(ORG_ID);
      expect(whereArg.organizationId).not.toBe(OTHER_ORG);
    });
  });

  describe('getSummary', () => {
    it('computes summary for organization products', async () => {
      const productFindMany = jest.fn().mockResolvedValue([
        {
          id: 'p1', costPrice: 10, minimumStock: 5,
          inventory: [{ quantity: 3 }],
        },
        {
          id: 'p2', costPrice: 20, minimumStock: 0,
          inventory: [{ quantity: 0 }],
        },
      ]);

      const service = new InventoryService({
        product: { findMany: productFindMany },
      } as unknown as PrismaService, {
        record: jest.fn(),
      } as never);

      const result = await service.getSummary(ORG_ID);

      expect(result.totalProducts).toBe(2);
      expect(result.totalStockUnits).toBe(3);
      expect(result.inventoryValue).toBe(30); // 3 * 10
      expect(result.lowStockCount).toBe(1); // p1: 3 <= 5
      expect(result.outOfStockCount).toBe(1); // p2: 0
    });

    it('scopes to organization', async () => {
      const productFindMany = jest.fn().mockResolvedValue([]);

      const service = new InventoryService({
        product: { findMany: productFindMany },
      } as unknown as PrismaService, {
        record: jest.fn(),
      } as never);

      await service.getSummary(ORG_ID);

      expect(productFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: ORG_ID, deletedAt: null },
        }),
      );
    });
  });
});
