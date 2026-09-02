import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';

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
        salesOrder: { findFirst: saleFindFirst, updateMany: saleUpdateMany },
        $transaction: transaction,
      } as unknown as PrismaService,
      {
        createReceivableForSales: receivable,
        createRevenueJournalEntry: revenueJournal,
        createCOGSJournalEntry: cogsJournal,
      } as never,
      { record: jest.fn().mockResolvedValue(undefined) } as never,
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

  it('scopes the inventory lookup to the sale organization', async () => {
    await service.deliver(ORG_ID, USER_ID, SALE_ID);

    expect(inventoryFindFirst).toHaveBeenCalledWith({
      where: { productId: PRODUCT_ID, warehouseId: null, product: { organizationId: ORG_ID } },
    });
  });

  it('rejects delivery when the inventory row belongs to another organization', async () => {
    inventoryFindFirst.mockResolvedValue(null);

    await expect(service.deliver(ORG_ID, USER_ID, SALE_ID)).rejects.toThrow(BadRequestException);
    expect(inventoryUpdateMany).not.toHaveBeenCalled();
    expect(inventoryTransactionCreate).not.toHaveBeenCalled();
    expect(receivable).not.toHaveBeenCalled();
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

describe('SalesService pricing (server-authoritative / P3-M2)', () => {
  let service: SalesService;
  let customerFindFirst: jest.Mock;
  let productFindMany: jest.Mock;
  let orderFindFirst: jest.Mock;
  let orderCreate: jest.Mock;
  let orderUpdate: jest.Mock;
  let itemDeleteMany: jest.Mock;
  let itemCreateMany: jest.Mock;
  let transaction: jest.Mock;

  beforeEach(() => {
    customerFindFirst = jest.fn().mockResolvedValue({ id: 'cust-1' });
    productFindMany = jest.fn().mockResolvedValue([{ id: PRODUCT_ID, name: 'Widget', unitPrice: 150 }]);
    orderFindFirst = jest.fn().mockResolvedValue(null);
    orderCreate = jest.fn().mockResolvedValue({ id: SALE_ID, orderNumber: 'SO-2026-000001', status: 'DRAFT', total: 0 });
    orderUpdate = jest.fn().mockResolvedValue({ id: SALE_ID });
    itemDeleteMany = jest.fn().mockResolvedValue({});
    itemCreateMany = jest.fn().mockResolvedValue({});

    const mockTx = {
      salesOrderItem: { deleteMany: itemDeleteMany, createMany: itemCreateMany },
      salesOrder: { update: orderUpdate },
    };
    transaction = jest.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx));

    service = new SalesService(
      {
        customer: { findFirst: customerFindFirst },
        product: { findMany: productFindMany },
        salesOrder: { findFirst: orderFindFirst, create: orderCreate },
        $transaction: transaction,
      } as unknown as PrismaService,
      {} as never,
      { record: jest.fn().mockResolvedValue(undefined) } as never,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('create() ignores client unitPrice and uses product.unitPrice for stored price and totals', async () => {
    await service.create(ORG_ID, USER_ID, {
      customerId: 'cust-1',
      items: [{ productId: PRODUCT_ID, quantity: 2, unitPrice: 1, discount: 0, tax: 0 }],
    });

    expect(productFindMany).toHaveBeenCalledWith({
      where: { id: { in: [PRODUCT_ID] }, organizationId: ORG_ID, deletedAt: null },
      select: expect.objectContaining({ unitPrice: true }),
    });

    expect(orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subtotal: 300,
          discount: 0,
          tax: 0,
          total: 300,
          items: {
            create: [
              expect.objectContaining({
                unitPrice: 150,
                lineTotal: 300,
              }),
            ],
          },
        }),
      }),
    );
  });

  it('create() keeps org scoping on the product lookup', async () => {
    await service.create(ORG_ID, USER_ID, {
      customerId: 'cust-1',
      items: [{ productId: PRODUCT_ID, quantity: 1, unitPrice: 1 }],
    });

    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: ORG_ID }) }),
    );
  });

  it('update() ignores client unitPrice and re-derives prices plus order totals', async () => {
    orderFindFirst.mockResolvedValue({ id: SALE_ID, organizationId: ORG_ID, status: 'DRAFT' });

    await service.update(ORG_ID, USER_ID, SALE_ID, {
      items: [{ productId: PRODUCT_ID, quantity: 3, unitPrice: 1, discount: 10, tax: 5 }],
    });

    expect(itemCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({ unitPrice: 150, lineTotal: 445, discount: 10, tax: 5 }),
        ],
      }),
    );
    expect(orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ subtotal: 450, discount: 10, tax: 5, total: 445 }),
      }),
    );
  });
});

describe('SalesService submit + confirm lifecycle (P3-M3/P3-L1)', () => {
  let service: SalesService;
  let orderFindFirst: jest.Mock;
  let orderUpdateMany: jest.Mock;
  const state = { status: 'DRAFT' };

  beforeEach(() => {
    state.status = 'DRAFT';
    orderFindFirst = jest.fn().mockImplementation(async () => ({ id: SALE_ID, organizationId: ORG_ID, status: state.status }));
    orderUpdateMany = jest.fn().mockImplementation(async ({ where, data }) => {
      if (where.status === state.status) {
        state.status = data?.status || state.status;
        return { count: 1 };
      }
      return { count: 0 };
    });

    service = new SalesService(
      {
        salesOrder: { findFirst: orderFindFirst, updateMany: orderUpdateMany },
      } as unknown as PrismaService,
      {} as never,
      { record: jest.fn().mockResolvedValue(undefined) } as never,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('throws NotFoundException when the sale does not exist', async () => {
    orderFindFirst.mockResolvedValue(null);

    await expect(service.submit(ORG_ID, USER_ID, SALE_ID)).rejects.toThrow(NotFoundException);
  });

  it('submit() transitions a DRAFT sale to PENDING', async () => {
    const result = await service.submit(ORG_ID, USER_ID, SALE_ID);

    expect(orderUpdateMany).toHaveBeenCalledWith({
      where: { id: SALE_ID, organizationId: ORG_ID, status: 'DRAFT', deletedAt: null },
      data: { status: 'PENDING' },
    });
    expect(result.status).toBe('PENDING');
  });

  it('submit() rejects non-DRAFT sales orders', async () => {
    state.status = 'CONFIRMED';

    await expect(service.submit(ORG_ID, USER_ID, SALE_ID)).rejects.toThrow(ConflictException);
  });

  it('submit() enforces organization scoping', async () => {
    await service.submit(ORG_ID, USER_ID, SALE_ID);

    expect(orderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: ORG_ID }) }),
    );
  });

  it('confirm() now succeeds for a PENDING sale (previously unreachable)', async () => {
    state.status = 'PENDING';

    const result = await service.confirm(ORG_ID, USER_ID, SALE_ID);

    expect(orderUpdateMany).toHaveBeenCalledWith({
      where: { id: SALE_ID, organizationId: ORG_ID, status: 'PENDING', deletedAt: null },
      data: { status: 'CONFIRMED' },
    });
    expect(result.status).toBe('CONFIRMED');
  });

  it('confirm() still rejects non-PENDING sales orders', async () => {
    state.status = 'DRAFT';

    await expect(service.confirm(ORG_ID, USER_ID, SALE_ID)).rejects.toThrow(ConflictException);
  });
});

describe('SalesController permission metadata (P3-L1)', () => {
  it('submit() requires sales.update', () => {
    const metadata = Reflect.getMetadata(PERMISSIONS_KEY, SalesController.prototype.submit);
    expect(metadata).toEqual({ permissions: ['sales.update'], mode: 'AND' });
  });

  it('confirm() requires sales.approve, not sales.update', () => {
    const metadata = Reflect.getMetadata(PERMISSIONS_KEY, SalesController.prototype.confirm);
    expect(metadata).toEqual({ permissions: ['sales.approve'], mode: 'AND' });
  });

  it('confirm() must not be protected by sales.update', () => {
    const metadata = Reflect.getMetadata(PERMISSIONS_KEY, SalesController.prototype.confirm);
    expect(metadata.permissions).not.toContain('sales.update');
  });
});

describe('SalesService pricing validation (V-1)', () => {
  let service: SalesService;
  let customerFindFirst: jest.Mock;
  let productFindMany: jest.Mock;
  let orderFindFirst: jest.Mock;
  let orderCreate: jest.Mock;
  let orderUpdate: jest.Mock;
  let itemDeleteMany: jest.Mock;
  let itemCreateMany: jest.Mock;
  let transaction: jest.Mock;

  beforeEach(() => {
    customerFindFirst = jest.fn().mockResolvedValue({ id: 'cust-1' });
    productFindMany = jest.fn().mockResolvedValue([{ id: PRODUCT_ID, name: 'Widget', unitPrice: 150 }]);
    orderFindFirst = jest.fn().mockResolvedValue(null);
    orderCreate = jest.fn().mockResolvedValue({ id: SALE_ID, orderNumber: 'SO-2026-000001', status: 'DRAFT', total: 0 });
    orderUpdate = jest.fn().mockResolvedValue({ id: SALE_ID });
    itemDeleteMany = jest.fn().mockResolvedValue({});
    itemCreateMany = jest.fn().mockResolvedValue({});

    const mockTx = {
      salesOrderItem: { deleteMany: itemDeleteMany, createMany: itemCreateMany },
      salesOrder: { update: orderUpdate },
    };
    transaction = jest.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx));

    service = new SalesService(
      {
        customer: { findFirst: customerFindFirst },
        product: { findMany: productFindMany },
        salesOrder: { findFirst: orderFindFirst, create: orderCreate },
        $transaction: transaction,
      } as unknown as PrismaService,
      {} as never,
      { record: jest.fn().mockResolvedValue(undefined) } as never,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('create() rejects a discount that exceeds the line subtotal', async () => {
    await expect(
      service.create(ORG_ID, USER_ID, {
        customerId: 'cust-1',
        items: [{ productId: PRODUCT_ID, quantity: 2, unitPrice: 0, discount: 400, tax: 0 }],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(orderCreate).not.toHaveBeenCalled();
  });

  it('create() accepts a discount equal to the line subtotal (zero-value line)', async () => {
    await service.create(ORG_ID, USER_ID, {
      customerId: 'cust-1',
      items: [{ productId: PRODUCT_ID, quantity: 2, unitPrice: 0, discount: 300, tax: 0 }],
    });

    expect(orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ subtotal: 300, discount: 300, tax: 0, total: 0 }),
      }),
    );
  });

  it('create() accepts a discount below the line subtotal', async () => {
    await service.create(ORG_ID, USER_ID, {
      customerId: 'cust-1',
      items: [{ productId: PRODUCT_ID, quantity: 2, unitPrice: 0, discount: 100, tax: 0 }],
    });

    expect(orderCreate).toHaveBeenCalled();
  });

  it('create() rejects a negative discount', async () => {
    await expect(
      service.create(ORG_ID, USER_ID, {
        customerId: 'cust-1',
        items: [{ productId: PRODUCT_ID, quantity: 2, unitPrice: 0, discount: -5, tax: 0 }],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(orderCreate).not.toHaveBeenCalled();
  });

  it('create() rejects a negative tax', async () => {
    await expect(
      service.create(ORG_ID, USER_ID, {
        customerId: 'cust-1',
        items: [{ productId: PRODUCT_ID, quantity: 2, unitPrice: 0, discount: 0, tax: -5 }],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(orderCreate).not.toHaveBeenCalled();
  });

  it('create() rejects a request whose total would be negative and persists nothing', async () => {
    await expect(
      service.create(ORG_ID, USER_ID, {
        customerId: 'cust-1',
        items: [{ productId: PRODUCT_ID, quantity: 2, unitPrice: 0, discount: 9999, tax: 0 }],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(orderCreate).not.toHaveBeenCalled();
  });

  it('create() succeeds for a valid multi-line order', async () => {
    productFindMany.mockResolvedValue([
      { id: PRODUCT_ID, name: 'Widget', unitPrice: 150 },
      { id: 'prod-2', name: 'Gadget', unitPrice: 100 },
    ]);

    await service.create(ORG_ID, USER_ID, {
      customerId: 'cust-1',
      items: [
        { productId: PRODUCT_ID, quantity: 1, unitPrice: 0, discount: 0, tax: 0 },
        { productId: 'prod-2', quantity: 1, unitPrice: 0, discount: 0, tax: 0 },
      ],
    });

    expect(orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ subtotal: 250, discount: 0, tax: 0, total: 250 }),
      }),
    );
  });

  it('update() rejects a discount that would make the total negative and persists nothing', async () => {
    orderFindFirst.mockResolvedValue({ id: SALE_ID, organizationId: ORG_ID, status: 'DRAFT' });

    await expect(
      service.update(ORG_ID, USER_ID, SALE_ID, {
        items: [{ productId: PRODUCT_ID, quantity: 2, unitPrice: 0, discount: 9999, tax: 0 }],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
    expect(itemDeleteMany).not.toHaveBeenCalled();
    expect(itemCreateMany).not.toHaveBeenCalled();
  });

  it('update() succeeds for a valid order', async () => {
    orderFindFirst.mockResolvedValue({ id: SALE_ID, organizationId: ORG_ID, status: 'DRAFT' });

    await service.update(ORG_ID, USER_ID, SALE_ID, {
      items: [{ productId: PRODUCT_ID, quantity: 2, unitPrice: 0, discount: 0, tax: 0 }],
    });

    expect(transaction).toHaveBeenCalled();
  });
});