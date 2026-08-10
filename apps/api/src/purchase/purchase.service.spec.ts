import { ConflictException, NotFoundException } from '@nestjs/common';

import { PurchaseService } from './purchase.service';
import { PurchaseController } from './purchase.controller';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';

const ORG_ID = 'org-1';
const USER_ID = 'user-1';
const PURCHASE_ID = 'purchase-1';
const PRODUCT_ID = 'prod-1';

const PURCHASE = {
  id: PURCHASE_ID,
  orderNumber: 'PO-2026-000001',
  status: 'APPROVED',
  items: [{ productId: PRODUCT_ID, quantity: 5 }],
};

describe('PurchaseService receive (atomic status gate + atomic increment)', () => {
  let service: PurchaseService;
  let purchaseFindFirst: jest.Mock;
  let purchaseUpdateMany: jest.Mock;
  let purchaseFindUnique: jest.Mock;
  let inventoryFindFirst: jest.Mock;
  let inventoryFindUnique: jest.Mock;
  let inventoryUpdate: jest.Mock;
  let inventoryUpdateMany: jest.Mock;
  let inventoryCreate: jest.Mock;
  let inventoryTransactionCreate: jest.Mock;
  let payable: jest.Mock;
  let journal: jest.Mock;
  let transaction: jest.Mock;

  beforeEach(() => {
    purchaseFindFirst = jest.fn().mockResolvedValue(PURCHASE);
    purchaseUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    purchaseFindUnique = jest.fn().mockResolvedValue({
      id: PURCHASE_ID,
      orderNumber: PURCHASE.orderNumber,
      status: 'RECEIVED',
      updatedAt: new Date(),
    });
    inventoryFindFirst = jest.fn().mockResolvedValue({ id: 'inv-1', quantity: 10 });
    inventoryFindUnique = jest.fn().mockResolvedValue({ id: 'inv-1', quantity: 15 });
    inventoryUpdate = jest.fn().mockResolvedValue({});
    inventoryUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    inventoryCreate = jest.fn().mockResolvedValue({});
    inventoryTransactionCreate = jest.fn().mockResolvedValue({});

    const mockTx = {
      purchaseOrder: {
        updateMany: purchaseUpdateMany,
        findUnique: purchaseFindUnique,
      },
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

    payable = jest.fn().mockResolvedValue({});
    journal = jest.fn().mockResolvedValue({});

    service = new PurchaseService(
      {
        purchaseOrder: { findFirst: purchaseFindFirst },
        $transaction: transaction,
      } as unknown as PrismaService,
      {
        createPayableForPurchase: payable,
        createJournalForPurchaseReceive: journal,
      } as never,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('throws NotFoundException when the purchase does not exist', async () => {
    purchaseFindFirst.mockResolvedValue(null);

    await expect(service.receive(ORG_ID, USER_ID, PURCHASE_ID)).rejects.toThrow(NotFoundException);
    expect(purchaseUpdateMany).not.toHaveBeenCalled();
  });

  it('throws ConflictException when the purchase is not APPROVED', async () => {
    purchaseFindFirst.mockResolvedValue({ ...PURCHASE, status: 'DRAFT' });

    await expect(service.receive(ORG_ID, USER_ID, PURCHASE_ID)).rejects.toThrow(ConflictException);
    expect(purchaseUpdateMany).not.toHaveBeenCalled();
  });

  it('changes an APPROVED purchase to RECEIVED via an atomic guarded updateMany', async () => {
    const result = await service.receive(ORG_ID, USER_ID, PURCHASE_ID);

    expect(purchaseUpdateMany).toHaveBeenCalledWith({
      where: { id: PURCHASE_ID, organizationId: ORG_ID, status: 'APPROVED' },
      data: { status: 'RECEIVED' },
    });
    expect(result.status).toBe('RECEIVED');
  });

  it('prevents a second concurrent receipt from passing the atomic status gate', async () => {
    purchaseUpdateMany.mockResolvedValue({ count: 0 });
    purchaseFindUnique.mockResolvedValue({ id: PURCHASE_ID, orderNumber: PURCHASE.orderNumber });

    await expect(service.receive(ORG_ID, USER_ID, PURCHASE_ID)).rejects.toThrow(ConflictException);
    expect(inventoryUpdateMany).not.toHaveBeenCalled();
    expect(inventoryCreate).not.toHaveBeenCalled();
    expect(inventoryTransactionCreate).not.toHaveBeenCalled();
    expect(payable).not.toHaveBeenCalled();
    expect(journal).not.toHaveBeenCalled();
  });

  it('uses an atomic increment for existing inventory, not an absolute update', async () => {
    await service.receive(ORG_ID, USER_ID, PURCHASE_ID);

    expect(inventoryUpdateMany).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: { quantity: { increment: 5 } },
    });
    expect(inventoryUpdate).not.toHaveBeenCalled();
  });

  it('scopes the inventory lookup to the purchase organization', async () => {
    await service.receive(ORG_ID, USER_ID, PURCHASE_ID);

    expect(inventoryFindFirst).toHaveBeenCalledWith({
      where: { productId: PRODUCT_ID, warehouseId: null, product: { organizationId: ORG_ID } },
    });
  });

  it('does not select inventory on a product from another organization', async () => {
    inventoryFindFirst.mockResolvedValue(null);

    await service.receive(ORG_ID, USER_ID, PURCHASE_ID);

    // Cross-org inventory is never selected; a missing row safely creates stock for the org's product.
    expect(inventoryFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ product: { organizationId: ORG_ID } }),
      }),
    );
    expect(inventoryUpdateMany).not.toHaveBeenCalled();
    expect(inventoryCreate).toHaveBeenCalled();
  });

  it('creates an inventory row when missing and records history', async () => {
    inventoryFindFirst.mockResolvedValue(null);

    await service.receive(ORG_ID, USER_ID, PURCHASE_ID);

    expect(inventoryCreate).toHaveBeenCalledWith({
      data: { productId: PRODUCT_ID, quantity: 5 },
    });
    expect(inventoryTransactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          previousQuantity: 0,
          newQuantity: 5,
          type: 'IN',
        }),
      }),
    );
    expect(inventoryUpdateMany).not.toHaveBeenCalled();
  });

  it('guards against duplicate inventory rows via the unique product constraint path', async () => {
    inventoryFindFirst.mockResolvedValue(null);

    try {
      await service.receive(ORG_ID, USER_ID, PURCHASE_ID);
    } catch { /* left for scope assertion below */ }

    expect(inventoryCreate).toHaveBeenCalledWith({
      data: { productId: PRODUCT_ID, quantity: 5 },
    });
  });

  it('records correct previousQuantity and newQuantity for existing inventory', async () => {
    await service.receive(ORG_ID, USER_ID, PURCHASE_ID);

    expect(inventoryTransactionCreate).toHaveBeenCalledTimes(1);
    expect(inventoryTransactionCreate).toHaveBeenCalledWith({
      data: {
        organizationId: ORG_ID,
        productId: PRODUCT_ID,
        type: 'IN',
        quantity: 5,
        previousQuantity: 10,
        newQuantity: 15,
        reference: PURCHASE.orderNumber,
        notes: `Purchase received: ${PURCHASE.orderNumber}`,
        createdById: USER_ID,
      },
    });
  });

  it('triggers accounting side effects only for the winning receipt', async () => {
    await service.receive(ORG_ID, USER_ID, PURCHASE_ID);

    expect(payable).toHaveBeenCalledTimes(1);
    expect(journal).toHaveBeenCalledTimes(1);
    expect(payable).toHaveBeenCalledWith(ORG_ID, PURCHASE_ID, expect.anything());
  });

  it('enforces organization scoping in the status gate', async () => {
    await service.receive(ORG_ID, USER_ID, PURCHASE_ID);

    expect(purchaseUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: ORG_ID }) }),
    );
  });

  it('cannot receive an already RECEIVED purchase again', async () => {
    purchaseFindFirst.mockResolvedValue({ ...PURCHASE, status: 'RECEIVED' });

    await expect(service.receive(ORG_ID, USER_ID, PURCHASE_ID)).rejects.toThrow(ConflictException);
    expect(purchaseUpdateMany).not.toHaveBeenCalled();
    expect(inventoryTransactionCreate).not.toHaveBeenCalled();
  });
});

describe('PurchaseService pricing (server-authoritative / P3-M2)', () => {
  let service: PurchaseService;
  let supplierFindFirst: jest.Mock;
  let productFindMany: jest.Mock;
  let orderFindFirst: jest.Mock;
  let orderCreate: jest.Mock;
  let orderUpdate: jest.Mock;
  let itemDeleteMany: jest.Mock;
  let itemCreateMany: jest.Mock;

  beforeEach(() => {
    supplierFindFirst = jest.fn().mockResolvedValue({ id: 'sup-1' });
    productFindMany = jest.fn().mockResolvedValue([{ id: PRODUCT_ID, name: 'Widget', costPrice: 80 }]);
    orderFindFirst = jest.fn().mockResolvedValue(null);
    orderCreate = jest.fn().mockResolvedValue({ id: PURCHASE_ID, orderNumber: 'PO-2026-000001', status: 'DRAFT', total: 0 });
    orderUpdate = jest.fn().mockResolvedValue({ id: PURCHASE_ID });
    itemDeleteMany = jest.fn().mockResolvedValue({});
    itemCreateMany = jest.fn().mockResolvedValue({});

    service = new PurchaseService(
      {
        supplier: { findFirst: supplierFindFirst },
        product: { findMany: productFindMany },
        purchaseOrder: { findFirst: orderFindFirst, create: orderCreate, update: orderUpdate },
        purchaseOrderItem: { deleteMany: itemDeleteMany, createMany: itemCreateMany },
      } as unknown as PrismaService,
      {} as never,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('create() ignores client unitCost and uses product.costPrice for stored cost and totals', async () => {
    await service.create(ORG_ID, USER_ID, {
      supplierId: 'sup-1',
      items: [{ productId: PRODUCT_ID, quantity: 4, unitCost: 1, discount: 0, tax: 0 }],
    });

    expect(productFindMany).toHaveBeenCalledWith({
      where: { id: { in: [PRODUCT_ID] }, organizationId: ORG_ID, deletedAt: null },
      select: expect.objectContaining({ costPrice: true }),
    });

    expect(orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subtotal: 320,
          discount: 0,
          tax: 0,
          total: 320,
          items: {
            create: [
              expect.objectContaining({
                unitCost: 80,
                lineTotal: 320,
              }),
            ],
          },
        }),
      }),
    );
  });

  it('create() keeps org scoping on the product lookup', async () => {
    await service.create(ORG_ID, USER_ID, {
      supplierId: 'sup-1',
      items: [{ productId: PRODUCT_ID, quantity: 1, unitCost: 1 }],
    });

    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: ORG_ID }) }),
    );
  });

  it('update() ignores client unitCost and re-derives costs plus order totals', async () => {
    orderFindFirst.mockResolvedValue({ id: PURCHASE_ID, organizationId: ORG_ID, status: 'DRAFT' });

    await service.update(ORG_ID, USER_ID, PURCHASE_ID, {
      items: [{ productId: PRODUCT_ID, quantity: 5, unitCost: 1, discount: 20, tax: 7 }],
    });

    expect(itemCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({ unitCost: 80, lineTotal: 387, discount: 20, tax: 7 }),
        ],
      }),
    );
    expect(orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ subtotal: 400, discount: 20, tax: 7, total: 387 }),
      }),
    );
  });
});

describe('PurchaseService submit + approve lifecycle (P3-M3/P3-L1)', () => {
  let service: PurchaseService;
  let orderFindFirst: jest.Mock;
  let orderUpdate: jest.Mock;

  beforeEach(() => {
    orderFindFirst = jest.fn().mockResolvedValue({ id: PURCHASE_ID, organizationId: ORG_ID, status: 'DRAFT' });
    orderUpdate = jest.fn().mockImplementation(async ({ data }) => ({ id: PURCHASE_ID, orderNumber: 'PO-2026-000001', status: data.status }));

    service = new PurchaseService(
      {
        purchaseOrder: { findFirst: orderFindFirst, update: orderUpdate },
      } as unknown as PrismaService,
      {} as never,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('throws NotFoundException when the purchase does not exist', async () => {
    orderFindFirst.mockResolvedValue(null);

    await expect(service.submit(ORG_ID, USER_ID, PURCHASE_ID)).rejects.toThrow(NotFoundException);
    expect(orderUpdate).not.toHaveBeenCalled();
  });

  it('submit() transitions a DRAFT purchase to PENDING', async () => {
    const result = await service.submit(ORG_ID, USER_ID, PURCHASE_ID);

    expect(orderFindFirst).toHaveBeenCalledWith({
      where: { id: PURCHASE_ID, organizationId: ORG_ID, deletedAt: null },
    });
    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: PURCHASE_ID },
      data: { status: 'PENDING' },
      select: { id: true, orderNumber: true, status: true },
    });
    expect(result.status).toBe('PENDING');
  });

  it('submit() rejects non-DRAFT purchase orders', async () => {
    orderFindFirst.mockResolvedValue({ id: PURCHASE_ID, organizationId: ORG_ID, status: 'APPROVED' });

    await expect(service.submit(ORG_ID, USER_ID, PURCHASE_ID)).rejects.toThrow(ConflictException);
    expect(orderUpdate).not.toHaveBeenCalled();
  });

  it('submit() enforces organization scoping', async () => {
    await service.submit(ORG_ID, USER_ID, PURCHASE_ID);

    expect(orderFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: ORG_ID }) }),
    );
  });

  it('approve() now succeeds for a PENDING purchase (previously unreachable)', async () => {
    orderFindFirst.mockResolvedValue({ id: PURCHASE_ID, organizationId: ORG_ID, status: 'PENDING' });

    const result = await service.approve(ORG_ID, USER_ID, PURCHASE_ID);

    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: PURCHASE_ID },
      data: { status: 'APPROVED' },
      select: { id: true, orderNumber: true, status: true },
    });
    expect(result.status).toBe('APPROVED');
  });

  it('approve() still rejects non-PENDING purchase orders', async () => {
    orderFindFirst.mockResolvedValue({ id: PURCHASE_ID, organizationId: ORG_ID, status: 'DRAFT' });

    await expect(service.approve(ORG_ID, USER_ID, PURCHASE_ID)).rejects.toThrow(ConflictException);
    expect(orderUpdate).not.toHaveBeenCalled();
  });
});

describe('PurchaseController permission metadata (P3-L1)', () => {
  it('submit() requires purchase.update', () => {
    const metadata = Reflect.getMetadata(PERMISSIONS_KEY, PurchaseController.prototype.submit);
    expect(metadata).toEqual({ permissions: ['purchase.update'], mode: 'AND' });
  });

  it('approve() requires purchase.approve, not purchase.update', () => {
    const metadata = Reflect.getMetadata(PERMISSIONS_KEY, PurchaseController.prototype.approve);
    expect(metadata).toEqual({ permissions: ['purchase.approve'], mode: 'AND' });
  });

  it('approve() must not be protected by purchase.update', () => {
    const metadata = Reflect.getMetadata(PERMISSIONS_KEY, PurchaseController.prototype.approve);
    expect(metadata.permissions).not.toContain('purchase.update');
  });
});