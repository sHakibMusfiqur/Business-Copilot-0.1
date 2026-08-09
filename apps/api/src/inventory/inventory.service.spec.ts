import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TransactionType } from '@prisma/client';

import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';

const ORG_ID = 'org-1';
const USER_ID = 'user-1';
const PRODUCT_ID = 'prod-1';

describe('InventoryService (concurrency-safe stock adjustments)', () => {
  let service: InventoryService;
  let productFindFirst: jest.Mock;
  let inventoryFindFirst: jest.Mock;
  let inventoryFindUnique: jest.Mock;
  let inventoryUpdate: jest.Mock;
  let inventoryUpdateMany: jest.Mock;
  let inventoryCreate: jest.Mock;
  let inventoryTransactionCreate: jest.Mock;
  let transaction: jest.Mock;

  beforeEach(() => {
    productFindFirst = jest.fn().mockResolvedValue({ id: PRODUCT_ID, name: 'Widget', sku: 'W-1' });
    inventoryFindFirst = jest.fn();
    inventoryFindUnique = jest.fn();
    inventoryUpdate = jest.fn().mockResolvedValue({});
    inventoryUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    inventoryCreate = jest.fn().mockResolvedValue({});
    inventoryTransactionCreate = jest.fn().mockResolvedValue({});

    const mockTx = {
      inventory: {
        findFirst: inventoryFindFirst,
        findUnique: inventoryFindUnique,
        update: inventoryUpdate,
        updateMany: inventoryUpdateMany,
        create: inventoryCreate,
      },
      inventoryTransaction: { create: inventoryTransactionCreate },
    };

    transaction = jest.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx));

    service = new InventoryService({
      product: { findFirst: productFindFirst },
      $transaction: transaction,
    } as unknown as PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
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

  describe('OUT adjustment', () => {
    it('succeeds when sufficient stock exists and uses atomic guarded decrement', async () => {
      inventoryFindFirst.mockResolvedValue({ id: 'inv-1', quantity: 10 });
      inventoryFindUnique.mockResolvedValue({ id: 'inv-1', quantity: 4 });

      const result = await service.adjust(ORG_ID, USER_ID, outDto(6));

      expect(inventoryUpdateMany).toHaveBeenCalledWith({
        where: { id: 'inv-1', quantity: { gte: 6 } },
        data: { quantity: { decrement: 6 } },
      });
      expect(result.previousQuantity).toBe(10);
      expect(result.newQuantity).toBe(4);
      expect(inventoryTransactionCreate).toHaveBeenCalledTimes(1);
    });

    it('fails when insufficient stock and does not write inventory', async () => {
      inventoryFindFirst.mockResolvedValue({ id: 'inv-1', quantity: 3 });
      // updateMany returns count=0 (WHERE quantity >= 6 fails)
      inventoryUpdateMany.mockResolvedValue({ count: 0 });
      inventoryFindUnique.mockResolvedValue({ id: 'inv-1', quantity: 3 });

      await expect(service.adjust(ORG_ID, USER_ID, outDto(6))).rejects.toThrow(BadRequestException);
      expect(inventoryUpdate).not.toHaveBeenCalled();
      expect(inventoryTransactionCreate).not.toHaveBeenCalled();
    });

    it('fails when no inventory row exists (implicit stock is 0)', async () => {
      inventoryFindFirst.mockResolvedValue(null);

      await expect(service.adjust(ORG_ID, USER_ID, outDto(6))).rejects.toThrow(BadRequestException);
      expect(inventoryUpdateMany).not.toHaveBeenCalled();
      expect(inventoryTransactionCreate).not.toHaveBeenCalled();
    });
  });

  describe('IN adjustment', () => {
    it('succeeds with existing inventory row using atomic increment', async () => {
      inventoryFindFirst.mockResolvedValue({ id: 'inv-1', quantity: 10 });
      inventoryFindUnique.mockResolvedValue({ id: 'inv-1', quantity: 15 });

      const result = await service.adjust(ORG_ID, USER_ID, inDto(5));

      expect(inventoryUpdateMany).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { quantity: { increment: 5 } },
      });
      expect(result.previousQuantity).toBe(10);
      expect(result.newQuantity).toBe(15);
      expect(inventoryTransactionCreate).toHaveBeenCalledTimes(1);
    });

    it('creates inventory row when no row exists', async () => {
      inventoryFindFirst.mockResolvedValue(null);

      const result = await service.adjust(ORG_ID, USER_ID, inDto(5));

      expect(inventoryUpdateMany).not.toHaveBeenCalled();
      expect(inventoryCreate).toHaveBeenCalledWith({
        data: { productId: PRODUCT_ID, quantity: 5 },
      });
      expect(result.previousQuantity).toBe(0);
      expect(result.newQuantity).toBe(5);
    });
  });

  describe('ADJUSTMENT (absolute set)', () => {
    it('sets absolute value with existing inventory', async () => {
      inventoryFindFirst.mockResolvedValue({ id: 'inv-1', quantity: 50 });

      const result = await service.adjust(ORG_ID, USER_ID, adjustDto(100));

      expect(inventoryUpdate).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { quantity: 100 },
      });
      expect(result.previousQuantity).toBe(50);
      expect(result.newQuantity).toBe(100);
    });

    it('creates inventory row when no row exists', async () => {
      inventoryFindFirst.mockResolvedValue(null);

      const result = await service.adjust(ORG_ID, USER_ID, adjustDto(100));

      expect(inventoryCreate).toHaveBeenCalledWith({
        data: { productId: PRODUCT_ID, quantity: 100 },
      });
      expect(result.previousQuantity).toBe(0);
      expect(result.newQuantity).toBe(100);
    });
  });

  describe('Concurrency safety', () => {
    it('uses atomic updateMany for OUT (not read-modify-write)', async () => {
      inventoryFindFirst.mockResolvedValue({ id: 'inv-1', quantity: 10 });
      inventoryFindUnique.mockResolvedValue({ id: 'inv-1', quantity: 4 });

      await service.adjust(ORG_ID, USER_ID, outDto(6));

      // The key concurrency mechanism: updateMany with WHERE quantity >= requested.
      // Under concurrent OUT requests, MySQL row-level locking ensures only one
      // transaction sees quantity >= requested; the other gets count=0.
      expect(inventoryUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ quantity: { gte: 6 } }),
        }),
      );
      // Must NOT use absolute-value update for OUT
      expect(inventoryUpdate).not.toHaveBeenCalled();
    });

    it('uses atomic updateMany for IN (not read-modify-write)', async () => {
      inventoryFindFirst.mockResolvedValue({ id: 'inv-1', quantity: 10 });
      inventoryFindUnique.mockResolvedValue({ id: 'inv-1', quantity: 15 });

      await service.adjust(ORG_ID, USER_ID, inDto(5));

      expect(inventoryUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ quantity: { increment: 5 } }),
        }),
      );
      expect(inventoryUpdate).not.toHaveBeenCalled();
    });

    it('rejects OUT when atomic update finds insufficient stock', async () => {
      inventoryFindFirst.mockResolvedValue({ id: 'inv-1', quantity: 5 });
      // Simulates concurrent decrement: WHERE quantity >= 6 fails
      inventoryUpdateMany.mockResolvedValue({ count: 0 });
      inventoryFindUnique.mockResolvedValue({ id: 'inv-1', quantity: 5 });

      await expect(service.adjust(ORG_ID, USER_ID, outDto(6))).rejects.toThrow(BadRequestException);

      expect(inventoryTransactionCreate).not.toHaveBeenCalled();
    });
  });

  describe('History record', () => {
    it('records correct previousQuantity and newQuantity for OUT', async () => {
      inventoryFindFirst.mockResolvedValue({ id: 'inv-1', quantity: 10 });
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

    it('records correct previousQuantity and newQuantity for IN', async () => {
      inventoryFindFirst.mockResolvedValue({ id: 'inv-1', quantity: 10 });
      inventoryFindUnique.mockResolvedValue({ id: 'inv-1', quantity: 15 });

      await service.adjust(ORG_ID, USER_ID, inDto(5));

      expect(inventoryTransactionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            previousQuantity: 10,
            newQuantity: 15,
          }),
        }),
      );
    });

    it('records no history on failed OUT', async () => {
      inventoryFindFirst.mockResolvedValue({ id: 'inv-1', quantity: 3 });
      inventoryUpdateMany.mockResolvedValue({ count: 0 });
      inventoryFindUnique.mockResolvedValue({ id: 'inv-1', quantity: 3 });

      await expect(service.adjust(ORG_ID, USER_ID, outDto(6))).rejects.toThrow();
      expect(inventoryTransactionCreate).not.toHaveBeenCalled();
    });
  });

  describe('Organization scoping', () => {
    it('validates product belongs to organization', async () => {
      productFindFirst.mockResolvedValue(null);

      await expect(service.adjust(ORG_ID, USER_ID, outDto(6))).rejects.toThrow(NotFoundException);
      expect(inventoryFindFirst).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('throws on invalid transaction type', async () => {
      inventoryFindFirst.mockResolvedValue({ id: 'inv-1', quantity: 10 });

      await expect(
        service.adjust(ORG_ID, USER_ID, { productId: PRODUCT_ID, type: 'INVALID' as TransactionType, quantity: 5 }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});