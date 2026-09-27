import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { InventoryCompatibilityService } from './inventory-compatibility.service';
import { InventoryService } from '../../inventory/inventory.service';
import { CreateStockAdjustmentDto } from '../../inventory/dto/create-stock-adjustment.dto';
import { QueryInventoryDto } from '../../inventory/dto/query-inventory.dto';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';

const ORG_ID = 'org-1';
const OTHER_ORG = 'org-2';
const USER_ID = 'user-1';
const PRODUCT_ID = 'prod-1';

const auditMock = () => ({ record: jest.fn().mockResolvedValue(undefined) });

const wrap = (legacy: InventoryService) => new InventoryCompatibilityService(legacy);

describe('InventoryCompatibilityService — legacy /inventory* contract', () => {
  afterEach(() => jest.clearAllMocks());

  describe('delegation identity (adaptor performs no transformation)', () => {
    it('list delegates to legacy findAll with identical arguments and returns its result', async () => {
      const productFindMany = jest.fn().mockResolvedValue([]);
      const productCount = jest.fn().mockResolvedValue(0);
      const legacy = new InventoryService({
        product: { findMany: productFindMany, count: productCount },
        $transaction: jest.fn(),
      } as unknown as PrismaService, auditMock() as unknown as AuditService);
      const findAll = jest.spyOn(legacy, 'findAll');
      const adaptor = wrap(legacy);
      const query = { page: 2, limit: 10, search: 'widget' };

      const result = await adaptor.list(ORG_ID, query);

      expect(findAll).toHaveBeenCalledWith(ORG_ID, query);
      expect(result).toBe(await findAll.mock.results[0].value);
    });

    it('adjust delegates to legacy adjust with identical arguments and returns its result', async () => {
      const legacy = new InventoryService({
        product: { findFirst: jest.fn().mockResolvedValue({ id: PRODUCT_ID, name: 'Widget', sku: 'W-1' }) },
        $transaction: jest.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb({
          $queryRaw: jest.fn().mockResolvedValue([{ id: 'inv-1', quantity: 10 }]),
          inventory: {
            findUnique: jest.fn().mockResolvedValue({ id: 'inv-1', quantity: 4 }),
            update: jest.fn(),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            create: jest.fn(),
          },
          inventoryTransaction: { create: jest.fn().mockResolvedValue({}) },
        })),
      } as unknown as PrismaService, auditMock() as unknown as AuditService);
      const adjust = jest.spyOn(legacy, 'adjust');
      const adaptor = wrap(legacy);
      const dto = { productId: PRODUCT_ID, type: TransactionType.OUT, quantity: 4, notes: 'note' };

      const result = await adaptor.adjust(ORG_ID, USER_ID, dto);

      expect(adjust).toHaveBeenCalledWith(ORG_ID, USER_ID, dto);
      expect(result).toBe(await adjust.mock.results[0].value);
    });

    it('summary delegates to legacy getSummary with identical arguments and returns its result', async () => {
      const legacy = new InventoryService({
        $queryRaw: jest.fn().mockResolvedValue([{
          totalProducts: BigInt(0),
          totalStockUnits: BigInt(0),
          inventoryValue: BigInt(0),
          lowStockCount: BigInt(0),
          outOfStockCount: BigInt(0),
        }]),
      } as unknown as PrismaService, auditMock() as unknown as AuditService);
      const getSummary = jest.spyOn(legacy, 'getSummary');
      const adaptor = wrap(legacy);

      const result = await adaptor.summary(ORG_ID);

      expect(getSummary).toHaveBeenCalledWith(ORG_ID);
      expect(result).toBe(await getSummary.mock.results[0].value);
    });

    it('history delegates to legacy getHistory with identical arguments and returns its result', async () => {
      const legacy = new InventoryService({
        product: { findFirst: jest.fn().mockResolvedValue({ id: PRODUCT_ID }) },
        inventoryTransaction: { findMany: jest.fn().mockResolvedValue([]) },
      } as unknown as PrismaService, auditMock() as unknown as AuditService);
      const getHistory = jest.spyOn(legacy, 'getHistory');
      const adaptor = wrap(legacy);

      const result = await adaptor.history(ORG_ID, PRODUCT_ID);

      expect(getHistory).toHaveBeenCalledWith(ORG_ID, PRODUCT_ID);
      expect(result).toBe(await getHistory.mock.results[0].value);
    });
  });

  describe('GET /inventory — list response', () => {
    const buildList = () => {
      const productFindMany = jest.fn().mockResolvedValue([]);
      const productCount = jest.fn().mockResolvedValue(0);
      const queryRaw = jest.fn().mockResolvedValue([]);
      const legacy = new InventoryService({
        product: { findMany: productFindMany, count: productCount },
        $queryRaw: queryRaw,
        $transaction: jest.fn(),
      } as unknown as PrismaService, auditMock() as unknown as AuditService);
      return { adaptor: wrap(legacy), productFindMany, productCount, queryRaw };
    };

    it('returns the { data, meta } envelope with computed currentStock', async () => {
      const { adaptor, productFindMany, productCount } = buildList();
      productCount.mockResolvedValue(25);
      productFindMany.mockResolvedValue([
        {
          id: 'p1', name: 'Widget', sku: 'W-1', minimumStock: 5, maximumStock: 100,
          unitPrice: 10, costPrice: 5, isActive: true, updatedAt: new Date(),
          categoryId: null, category: null, supplierId: null, supplier: null,
          inventory: [{ quantity: 3 }, { quantity: 7 }],
        },
      ]);

      const result = await adaptor.list(ORG_ID, { page: 2, limit: 10 });

      expect(result.meta).toEqual({ total: 25, page: 2, limit: 10, totalPages: 3 });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].currentStock).toBe(10);
      expect(Object.keys(result.data[0]).sort()).toEqual([
        'category', 'categoryId', 'costPrice', 'currentStock', 'id', 'isActive',
        'maximumStock', 'minimumStock', 'name', 'sku', 'supplier', 'supplierId',
        'unitPrice', 'updatedAt',
      ]);
    });

    it('always scopes the product query to the caller organization', async () => {
      const { adaptor, productFindMany } = buildList();

      await adaptor.list(ORG_ID, {});

      const whereArg = productFindMany.mock.calls[0][0].where;
      expect(whereArg.organizationId).toBe(ORG_ID);
      expect(whereArg.organizationId).not.toBe(OTHER_ORG);
      expect(whereArg.deletedAt).toBeNull();
    });

    it('keeps search over name/sku/barcode/brand trimmed and case-insensitive', async () => {
      const { adaptor, productFindMany } = buildList();

      await adaptor.list(ORG_ID, { search: '  widget  ' });

      const whereArg = productFindMany.mock.calls[0][0].where;
      expect(whereArg.OR).toEqual([
        { name: { contains: 'widget', mode: 'insensitive' } },
        { sku: { contains: 'widget', mode: 'insensitive' } },
        { barcode: { contains: 'widget', mode: 'insensitive' } },
        { brand: { contains: 'widget', mode: 'insensitive' } },
      ]);
    });

    it('returns the same shape keys on the raw lowStock/outOfStock path', async () => {
      const { adaptor, queryRaw } = buildList();
      queryRaw.mockResolvedValue([{
        id: 'p1', name: 'Widget', sku: 'W-1', categoryId: null, categoryName: null,
        supplierId: null, supplierName: null, unitPrice: 10, costPrice: 5,
        minimumStock: 5, maximumStock: 100, isActive: true, updatedAt: new Date(),
        currentStock: BigInt(2),
      }]);

      const result = await adaptor.list(ORG_ID, { lowStock: true });

      expect(Object.keys(result.data[0]).sort()).toEqual([
        'category', 'categoryId', 'costPrice', 'currentStock', 'id', 'isActive',
        'maximumStock', 'minimumStock', 'name', 'sku', 'supplier', 'supplierId',
        'unitPrice', 'updatedAt',
      ]);
      expect(result.data[0].currentStock).toBe(2);
      expect(Object.keys(result.meta).sort()).toEqual(['limit', 'page', 'total', 'totalPages']);
      const templateStrings = queryRaw.mock.calls[0][0];
      expect(templateStrings.join('?')).toContain('p."organizationId"');
      expect(queryRaw.mock.calls[0][1]).toBe(ORG_ID);
    });
  });

  describe('POST /inventory/adjust — mutation semantics and side effects', () => {
    const buildAdjust = () => {
      const productFindFirst = jest.fn().mockResolvedValue({ id: PRODUCT_ID, name: 'Widget', sku: 'W-1' });
      const inventoryFindUnique = jest.fn();
      const inventoryUpdate = jest.fn().mockResolvedValue({});
      const inventoryUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
      const inventoryCreate = jest.fn().mockResolvedValue({});
      const inventoryTransactionCreate = jest.fn().mockResolvedValue({});
      const queryRaw = jest.fn().mockResolvedValue([]);
      const transaction = jest.fn();
      const auditRecord = jest.fn().mockResolvedValue(undefined);

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
      transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx));

      const legacy = new InventoryService({
        product: { findFirst: productFindFirst },
        $transaction: transaction,
      } as unknown as PrismaService, { record: auditRecord } as unknown as AuditService);

      return {
        adaptor: wrap(legacy),
        queryRaw,
        inventoryFindUnique,
        inventoryUpdate,
        inventoryUpdateMany,
        inventoryCreate,
        inventoryTransactionCreate,
        auditRecord,
        productFindFirst,
      };
    };

    const outDto = (quantity = 6, notes?: string) => ({
      productId: PRODUCT_ID, type: TransactionType.OUT, quantity, notes,
    });

    it('IN uses atomic increment and records the legacy transaction fields', async () => {
      const { adaptor, queryRaw, inventoryFindUnique, inventoryUpdateMany, inventoryTransactionCreate } = buildAdjust();
      queryRaw.mockResolvedValue([{ id: 'inv-1', quantity: 10 }]);
      inventoryFindUnique.mockResolvedValue({ id: 'inv-1', quantity: 15 });

      const result = await adaptor.adjust(ORG_ID, USER_ID, {
        productId: PRODUCT_ID, type: TransactionType.IN, quantity: 5, notes: 'restock',
      });

      expect(inventoryUpdateMany).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { quantity: { increment: 5 } },
      });
      expect(inventoryTransactionCreate).toHaveBeenCalledWith({
        data: {
          organizationId: ORG_ID,
          productId: PRODUCT_ID,
          type: TransactionType.IN,
          quantity: 5,
          previousQuantity: 10,
          newQuantity: 15,
          notes: 'restock',
          createdById: USER_ID,
        },
      });
      expect(result).toEqual({
        productId: PRODUCT_ID,
        productName: 'Widget',
        productSku: 'W-1',
        type: TransactionType.IN,
        quantity: 5,
        previousQuantity: 10,
        newQuantity: 15,
      });
    });

    it('OUT applies the atomic oversell guard and locks rows with SELECT ... FOR UPDATE', async () => {
      const { adaptor, queryRaw, inventoryFindUnique, inventoryUpdateMany } = buildAdjust();
      queryRaw.mockResolvedValue([{ id: 'inv-1', quantity: 10 }]);
      inventoryFindUnique.mockResolvedValue({ id: 'inv-1', quantity: 4 });

      const result = await adaptor.adjust(ORG_ID, USER_ID, outDto(6));

      expect(queryRaw).toHaveBeenCalled();
      expect(inventoryUpdateMany).toHaveBeenCalledWith({
        where: { id: 'inv-1', quantity: { gte: 6 } },
        data: { quantity: { decrement: 6 } },
      });
      expect(result.previousQuantity).toBe(10);
      expect(result.newQuantity).toBe(4);
    });

    it('OUT rejects overselling with BadRequest and writes no history row', async () => {
      const { adaptor, queryRaw, inventoryFindUnique, inventoryUpdateMany, inventoryTransactionCreate, auditRecord } = buildAdjust();
      queryRaw.mockResolvedValue([{ id: 'inv-1', quantity: 3 }]);
      inventoryFindUnique.mockResolvedValue({ id: 'inv-1', quantity: 3 });
      inventoryUpdateMany.mockResolvedValue({ count: 0 });

      await expect(adaptor.adjust(ORG_ID, USER_ID, outDto(6))).rejects.toThrow(BadRequestException);
      expect(inventoryTransactionCreate).not.toHaveBeenCalled();
      expect(auditRecord).not.toHaveBeenCalled();
    });

    it('ADJUSTMENT sets the absolute quantity (last-write-wins)', async () => {
      const { adaptor, queryRaw, inventoryUpdate } = buildAdjust();
      queryRaw.mockResolvedValue([{ id: 'inv-1', quantity: 50 }]);

      const result = await adaptor.adjust(ORG_ID, USER_ID, {
        productId: PRODUCT_ID, type: TransactionType.ADJUSTMENT, quantity: 100,
      });

      expect(inventoryUpdate).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { quantity: 100 },
      });
      expect(result.previousQuantity).toBe(50);
      expect(result.newQuantity).toBe(100);
    });

    it('rejects a cross-organization product with NotFound before locking', async () => {
      const { adaptor, productFindFirst, queryRaw } = buildAdjust();
      productFindFirst.mockResolvedValue(null);

      await expect(adaptor.adjust(ORG_ID, USER_ID, outDto(6))).rejects.toThrow(NotFoundException);
      expect(queryRaw).not.toHaveBeenCalled();
    });

    it('rejects an invalid transaction type with BadRequest', async () => {
      const { adaptor, queryRaw } = buildAdjust();
      queryRaw.mockResolvedValue([{ id: 'inv-1', quantity: 10 }]);

      await expect(
        adaptor.adjust(ORG_ID, USER_ID, {
          productId: PRODUCT_ID,
          type: 'INVALID' as TransactionType,
          quantity: 5,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('records the legacy audit entry INVENTORY_{type} against the product', async () => {
      const { adaptor, queryRaw, inventoryFindUnique, auditRecord } = buildAdjust();
      queryRaw.mockResolvedValue([{ id: 'inv-1', quantity: 10 }]);
      inventoryFindUnique.mockResolvedValue({ id: 'inv-1', quantity: 4 });

      await adaptor.adjust(ORG_ID, USER_ID, outDto(6));

      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          organizationId: ORG_ID,
          action: 'INVENTORY_OUT',
          entity: 'Product',
          entityId: PRODUCT_ID,
          status: 'SUCCESS',
        }),
      );
    });
  });

  describe('GET /inventory/summary — summary response', () => {
    const buildSummary = () => {
      const queryRaw = jest.fn().mockResolvedValue([{
        totalProducts: BigInt(2),
        totalStockUnits: BigInt(3),
        inventoryValue: BigInt(30),
        lowStockCount: BigInt(1),
        outOfStockCount: BigInt(1),
      }]);
      const legacy = new InventoryService({
        $queryRaw: queryRaw,
      } as unknown as PrismaService, auditMock() as unknown as AuditService);
      return { adaptor: wrap(legacy), queryRaw };
    };

    it('returns the six numeric summary fields with bigint conversion', async () => {
      const { adaptor } = buildSummary();

      const result = await adaptor.summary(ORG_ID);

      expect(result).toEqual({
        totalProducts: 2,
        totalStockUnits: 3,
        inventoryValue: 30,
        lowStockCount: 1,
        outOfStockCount: 1,
        averageProductValue: 15,
      });
      Object.values(result).forEach((value) => expect(typeof value).toBe('number'));
    });

    it('preserves the costPrice-based inventoryValue formula and organization scope', async () => {
      const { adaptor, queryRaw } = buildSummary();

      await adaptor.summary(ORG_ID);

      const templateStrings = queryRaw.mock.calls[0][0];
      const fullQuery = templateStrings.join('?');
      expect(fullQuery).toContain('p."organizationId"');
      expect(fullQuery).toContain('COALESCE(s.stock, 0) * COALESCE(p."costPrice", 0)');
      expect(queryRaw.mock.calls[0][1]).toBe(ORG_ID);
    });

    it('returns averageProductValue 0 when the organization has no products', async () => {
      const legacyOnly = new InventoryService({
        $queryRaw: jest.fn().mockResolvedValue([{
          totalProducts: BigInt(0),
          totalStockUnits: BigInt(0),
          inventoryValue: BigInt(0),
          lowStockCount: BigInt(0),
          outOfStockCount: BigInt(0),
        }]),
      } as unknown as PrismaService, auditMock() as unknown as AuditService);

      const result = await wrap(legacyOnly).summary(ORG_ID);

      expect(result.averageProductValue).toBe(0);
    });
  });

  describe('GET /inventory/:productId/history — history response', () => {
    const buildHistory = () => {
      const productFindFirst = jest.fn().mockResolvedValue({ id: PRODUCT_ID });
      const findMany = jest.fn().mockResolvedValue([
        {
          id: 'tx1', type: 'IN', quantity: 5, previousQuantity: 0, newQuantity: 5,
          reference: null, notes: null, createdAt: new Date(),
          createdBy: { id: 'u1', name: 'Admin' },
        },
      ]);
      const legacy = new InventoryService({
        product: { findFirst: productFindFirst },
        inventoryTransaction: { findMany },
      } as unknown as PrismaService, auditMock() as unknown as AuditService);
      return { adaptor: wrap(legacy), productFindFirst, findMany };
    };

    it('returns legacy transaction rows newest-first with createdBy { id, name }', async () => {
      const { adaptor, findMany } = buildHistory();

      const result = await adaptor.history(ORG_ID, PRODUCT_ID);

      expect(result).toHaveLength(1);
      expect(Object.keys(result[0]).sort()).toEqual([
        'createdAt', 'createdBy', 'id', 'newQuantity', 'notes', 'previousQuantity',
        'quantity', 'reference', 'type',
      ]);
      expect(result[0].createdBy).toEqual({ id: 'u1', name: 'Admin' });
      expect(result[0].type).toBe('IN');
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId: PRODUCT_ID, organizationId: ORG_ID },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('never leaks transactions from other organizations', async () => {
      const { adaptor, findMany } = buildHistory();

      await adaptor.history(ORG_ID, PRODUCT_ID);

      const whereArg = findMany.mock.calls[0][0].where;
      expect(whereArg.organizationId).toBe(ORG_ID);
      expect(whereArg.organizationId).not.toBe(OTHER_ORG);
    });

    it('throws NotFound for a missing or cross-organization product', async () => {
      const { adaptor, productFindFirst } = buildHistory();
      productFindFirst.mockResolvedValue(null);

      await expect(adaptor.history(ORG_ID, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('validation contract (class-validator, as enforced by ValidationPipe)', () => {
    it('accepts a valid legacy adjustment payload', async () => {
      const dto = plainToInstance(CreateStockAdjustmentDto, {
        productId: PRODUCT_ID, type: 'IN', quantity: 5, notes: 'ok',
      });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects quantity below 1 and unknown transaction types', async () => {
      const badQuantity = plainToInstance(CreateStockAdjustmentDto, {
        productId: PRODUCT_ID, type: 'IN', quantity: 0,
      });
      expect((await validate(badQuantity)).find((e) => e.property === 'quantity')).toBeDefined();

      const badType = plainToInstance(CreateStockAdjustmentDto, {
        productId: PRODUCT_ID, type: 'BOGUS', quantity: 1,
      });
      expect((await validate(badType)).find((e) => e.property === 'type')).toBeDefined();
    });

    it('rejects out-of-range query parameters on GET /inventory', async () => {
      const badPage = plainToInstance(QueryInventoryDto, { page: 0 });
      expect((await validate(badPage)).find((e) => e.property === 'page')).toBeDefined();

      const badLimit = plainToInstance(QueryInventoryDto, { limit: 1000 });
      expect((await validate(badLimit)).find((e) => e.property === 'limit')).toBeDefined();

      const ok = plainToInstance(QueryInventoryDto, { page: 1, limit: 10, sortOrder: 'asc' });
      expect(await validate(ok)).toHaveLength(0);
    });
  });
});
