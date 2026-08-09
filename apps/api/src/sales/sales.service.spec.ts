import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { SalesService } from './sales.service';
import { PrismaService } from '../prisma/prisma.service';

const ORG_ID = 'org-1';
const USER_ID = 'user-1';
const SALE_ID = 'sale-1';
const PRODUCT_ID = 'prod-1';

const SALE = {
  id: SALE_ID,
  orderNumber: 'SO-2026-000001',
  status: 'CONFIRMED',
  items: [{ productId: PRODUCT_ID, quantity: 6 }],
};

describe('SalesService deliver (atomic status gate + guarded decrement)', () => {
  let service: SalesService;
  let saleFindFirst: jest.Mock;
  let saleUpdateMany: jest.Mock;
  let saleFindUnique: jest.Mock;
  let inventoryFindFirst: jest.Mock;
  let inventoryFindUnique: jest.Mock;
  let inventoryUpdate: jest.Mock;
  let inventoryUpdateMany: jest.Mock;
  let inventoryTransactionCreate: jest.Mock;
  let receivable: jest.Mock;
  let revenueJournal: jest.Mock;
  let cogsJournal: jest.Mock;
  let transaction: jest.Mock;

  beforeEach(() => {
    saleFindFirst = jest.fn().mockResolvedValue(SALE);
    saleUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    saleFindUnique = jest.fn().mockResolvedValue({
      id: SALE_ID,
      orderNumber: SALE.orderNumber,
      status: 'DELIVERED',
      updatedAt: new Date(),
    });
    inventoryFindFirst = jest.fn().mockResolvedValue({ id: 'inv-1', quantity: 10 });
    inventoryFindUnique = jest.fn().mockResolvedValue({ id: 'inv-1', quantity: 4 });
    inventoryUpdate = jest.fn().mockResolvedValue({});
    inventoryUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    inventoryTransactionCreate = jest.fn().mockResolvedValue({});

    const mockTx = {
      salesOrder: {
        updateMany: saleUpdateMany,
        findUnique: saleFindUnique,
      },
      inventory: {
        findFirst: inventoryFindFirst,
        findUnique: inventoryFindUnique,
        update: inventoryUpdate,
        updateMany: inventoryUpdateMany,
      },
      inventoryTransaction: { create: inventoryTransactionCreate },
    };

    transaction = jest.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx));

    receivable = jest.fn().mockResolvedValue({});
    revenueJournal = jest.fn().mockResolvedValue({});
    cogsJournal = jest.fn().mockResolvedValue({});

    service = new SalesService(
      {
        salesOrder: { findFirst: saleFindFirst },
        $transaction: transaction,
      } as unknown as PrismaService,
      {
        createReceivableForSales: receivable,
        createRevenueJournalEntry: revenueJournal,
        createCOGSJournalEntry: cogsJournal,
      } as never,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('throws NotFoundException when the sale does not exist', async () => {
    saleFindFirst.mockResolvedValue(null);

    await expect(service.deliver(ORG_ID, USER_ID, SALE_ID)).rejects.toThrow(NotFoundException);
    expect(saleUpdateMany).not.toHaveBeenCalled();
  });

  it('throws ConflictException when the sale is not CONFIRMED', async () => {
    saleFindFirst.mockResolvedValue({ ...SALE, status: 'DRAFT' });

    await expect(service.deliver(ORG_ID, USER_ID, SALE_ID)).rejects.toThrow(ConflictException);
    expect(saleUpdateMany).not.toHaveBeenCalled();
  });

  it('changes a CONFIRMED sale to DELIVERED via an atomic guarded updateMany', async () => {
    const result = await service.deliver(ORG_ID, USER_ID, SALE_ID);

    expect(saleUpdateMany).toHaveBeenCalledWith({
      where: { id: SALE_ID, organizationId: ORG_ID, status: 'CONFIRMED' },
      data: { status: 'DELIVERED' },
    });
    expect(result.status).toBe('DELIVERED');
  });

  it('prevents a second concurrent delivery from passing the atomic status gate', async () => {
    saleUpdateMany.mockResolvedValue({ count: 0 });
    saleFindUnique.mockResolvedValue({ id: SALE_ID, orderNumber: SALE.orderNumber });

    await expect(service.deliver(ORG_ID, USER_ID, SALE_ID)).rejects.toThrow(ConflictException);
    expect(inventoryUpdateMany).not.toHaveBeenCalled();
    expect(inventoryUpdate).not.toHaveBeenCalled();
    expect(inventoryTransactionCreate).not.toHaveBeenCalled();
    expect(receivable).not.toHaveBeenCalled();
    expect(revenueJournal).not.toHaveBeenCalled();
    expect(cogsJournal).not.toHaveBeenCalled();
  });

  it('uses an atomic guarded decrement (gte) for inventory, not an absolute update', async () => {
    await service.deliver(ORG_ID, USER_ID, SALE_ID);

    expect(inventoryUpdateMany).toHaveBeenCalledWith({
      where: { id: 'inv-1', quantity: { gte: 6 } },
      data: { quantity: { decrement: 6 } },
    });
    expect(inventoryUpdate).not.toHaveBeenCalled();
  });

  it('rejects delivery when stock is insufficient and writes no history', async () => {
    inventoryFindUnique.mockResolvedValue({ id: 'inv-1', quantity: 3 });
    inventoryUpdateMany.mockResolvedValue({ count: 0 });

    await expect(service.deliver(ORG_ID, USER_ID, SALE_ID)).rejects.toThrow(BadRequestException);
    expect(inventoryTransactionCreate).not.toHaveBeenCalled();
    expect(receivable).not.toHaveBeenCalled();
    expect(revenueJournal).not.toHaveBeenCalled();
    expect(cogsJournal).not.toHaveBeenCalled();
  });

  it('records correct previousQuantity and newQuantity in history', async () => {
    await service.deliver(ORG_ID, USER_ID, SALE_ID);

    expect(inventoryTransactionCreate).toHaveBeenCalledTimes(1);
    expect(inventoryTransactionCreate).toHaveBeenCalledWith({
      data: {
        organizationId: ORG_ID,
        productId: PRODUCT_ID,
        type: 'OUT',
        quantity: 6,
        previousQuantity: 10,
        newQuantity: 4,
        reference: SALE.orderNumber,
        notes: `Sales delivered: ${SALE.orderNumber}`,
        createdById: USER_ID,
      },
    });
  });

  it('triggers accounting side effects only for the winning delivery', async () => {
    await service.deliver(ORG_ID, USER_ID, SALE_ID);

    expect(receivable).toHaveBeenCalledTimes(1);
    expect(revenueJournal).toHaveBeenCalledTimes(1);
    expect(cogsJournal).toHaveBeenCalledTimes(1);
    expect(receivable).toHaveBeenCalledWith(ORG_ID, SALE_ID, expect.anything());
  });

  it('enforces organization scoping in the status gate', async () => {
    await service.deliver(ORG_ID, USER_ID, SALE_ID);

    expect(saleUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: ORG_ID }) }),
    );
  });

  it('cannot deliver an already DELIVERED sale again', async () => {
    saleFindFirst.mockResolvedValue({ ...SALE, status: 'DELIVERED' });

    await expect(service.deliver(ORG_ID, USER_ID, SALE_ID)).rejects.toThrow(ConflictException);
    expect(saleUpdateMany).not.toHaveBeenCalled();
    expect(inventoryTransactionCreate).not.toHaveBeenCalled();
  });
});