import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { InventoryTransaction } from '../interfaces';
import { PrismaInventoryTransactionRepository } from './inventory-transaction.repository';

const ORG_A = 'org-a';
const ORG_B = 'org-b';

type InventoryTransactionData = Omit<InventoryTransaction, 'id' | 'createdAt'>;

function buildRepository() {
  const create = jest.fn();
  const findFirst = jest.fn();
  const findMany = jest.fn();
  const model = { create, findFirst, findMany };
  const prisma = { inventoryTransaction: model } as unknown as PrismaService;
  const repository = new PrismaInventoryTransactionRepository(prisma);
  return { repository, model, create, findFirst, findMany };
}

function buildLegacyData(
  overrides: Partial<InventoryTransactionData> = {},
): InventoryTransactionData {
  return {
    organizationId: ORG_A,
    productId: 'prod-1',
    type: 'IN',
    quantity: 10,
    previousQuantity: 0,
    newQuantity: 10,
    reference: 'PO-1',
    notes: null,
    createdById: 'user-1',
    transactionType: null,
    referenceType: null,
    referenceId: null,
    totalQuantity: null,
    totalValue: null,
    status: null,
    metadata: null,
    ...overrides,
  };
}

describe('PrismaInventoryTransactionRepository', () => {
  afterEach(() => jest.clearAllMocks());

  it('is append-only: exposes no update or delete methods', () => {
    const { repository, model } = buildRepository();

    expect(
      (repository as unknown as Record<string, unknown>).update,
    ).toBeUndefined();
    expect(
      (repository as unknown as Record<string, unknown>).delete,
    ).toBeUndefined();
    expect('update' in model).toBe(false);
    expect('delete' in model).toBe(false);
  });

  it('create: legacy fields remain intact and untouched', async () => {
    const { repository, create } = buildRepository();
    const data = buildLegacyData();
    const created = { id: 'it-1', ...data, createdAt: new Date() };
    create.mockResolvedValue(created);

    await expect(repository.create(data)).resolves.toEqual(created);
    expect(create).toHaveBeenCalledWith({ data });
    const passed = (create.mock.calls[0][0] as { data: InventoryTransactionData }).data;
    expect(passed.type).toBe('IN');
    expect(passed.quantity).toBe(10);
    expect(passed.previousQuantity).toBe(0);
    expect(passed.newQuantity).toBe(10);
    expect(passed.reference).toBe('PO-1');
    expect(passed.createdById).toBe('user-1');
  });

  it('create: engine transactionType does not overwrite legacy type and both coexist', async () => {
    const { repository, create } = buildRepository();
    const data = buildLegacyData({
      type: 'IN',
      transactionType: 'PURCHASE',
      referenceType: 'purchase_order',
      referenceId: 'po-9',
      totalQuantity: 50,
      totalValue: new Prisma.Decimal('125.50'),
      status: 'COMPLETED',
      metadata: { source: 'engine' },
    });
    create.mockResolvedValue({ id: 'it-2', ...data, createdAt: new Date() });

    await repository.create(data);

    const passed = (create.mock.calls[0][0] as { data: InventoryTransactionData }).data;
    expect(passed.type).toBe('IN');
    expect(passed.transactionType).toBe('PURCHASE');
    expect(passed.type).not.toBe(passed.transactionType);
    expect(passed.referenceType).toBe('purchase_order');
    expect(passed.referenceId).toBe('po-9');
    expect(passed.totalQuantity).toBe(50);
    expect(passed.status).toBe('COMPLETED');
  });

  it('create: nullable engine fields may be null (legacy row shape)', async () => {
    const { repository, create } = buildRepository();
    const data = buildLegacyData();
    create.mockResolvedValue({ id: 'it-3', ...data, createdAt: new Date() });

    await repository.create(data);

    const passed = (create.mock.calls[0][0] as { data: InventoryTransactionData }).data;
    expect(passed.transactionType).toBeNull();
    expect(passed.referenceType).toBeNull();
    expect(passed.referenceId).toBeNull();
    expect(passed.totalQuantity).toBeNull();
    expect(passed.totalValue).toBeNull();
    expect(passed.status).toBeNull();
    expect(passed.metadata).toBeNull();
  });

  it('findById: constrains by organizationId + id', async () => {
    const { repository, findFirst } = buildRepository();
    findFirst.mockResolvedValue(null);

    await repository.findById(ORG_A, 'it-1');

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'it-1', organizationId: ORG_A },
    });
  });

  it('findById: cross-organization transaction is not visible under org A', async () => {
    const { repository, findFirst } = buildRepository();
    findFirst.mockImplementation(
      async (args: { where: Record<string, unknown> }) =>
        args.where.organizationId === ORG_B
          ? { id: 'it-1', organizationId: ORG_B }
          : null,
    );

    await expect(repository.findById(ORG_A, 'it-1')).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: ORG_A }),
      }),
    );
  });

  it('findByOrganization: scoped to organization only', async () => {
    const { repository, findMany } = buildRepository();
    findMany.mockResolvedValue([]);

    await repository.findByOrganization(ORG_A);

    expect(findMany).toHaveBeenCalledWith({ where: { organizationId: ORG_A } });
  });
});
