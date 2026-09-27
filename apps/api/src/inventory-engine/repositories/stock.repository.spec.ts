import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { Stock } from '../interfaces';
import { PrismaStockRepository } from './stock.repository';

const ORG_A = 'org-a';
const ORG_B = 'org-b';

type StockData = Omit<Stock, 'id' | 'createdAt' | 'updatedAt'>;

function buildRepository() {
  const create = jest.fn();
  const findFirst = jest.fn();
  const findMany = jest.fn();
  const update = jest.fn();
  const model = { create, findFirst, findMany, update };
  const prisma = { stock: model } as unknown as PrismaService;
  const repository = new PrismaStockRepository(prisma);
  return { repository, model, create, findFirst, findMany, update };
}

function buildStockData(overrides: Partial<StockData> = {}): StockData {
  return {
    organizationId: ORG_A,
    warehouseId: 'wh-1',
    productId: 'prod-1',
    batchId: null,
    serialNumberId: null,
    quantity: 10,
    reservedQuantity: 0,
    damagedQuantity: 0,
    returnedQuantity: 0,
    inTransitQuantity: 0,
    safetyStock: 0,
    reorderLevel: 0,
    unitCost: new Prisma.Decimal('5.50'),
    totalValue: new Prisma.Decimal('55.00'),
    status: 'ACTIVE',
    metadata: {},
    ...overrides,
  };
}

describe('PrismaStockRepository', () => {
  afterEach(() => jest.clearAllMocks());

  it('create: passes composite-key fields with nullable batchId/serialNumberId as null', async () => {
    const { repository, create } = buildRepository();
    const data = buildStockData({ batchId: null, serialNumberId: null });
    const created = { id: 'stock-1', ...data, createdAt: new Date(), updatedAt: new Date() };
    create.mockResolvedValue(created);

    await expect(repository.create(data)).resolves.toEqual(created);
    expect(create).toHaveBeenCalledWith({ data });
  });

  it('create: propagates composite unique-constraint failure (P2002) on [warehouseId, productId, batchId, serialNumberId]', async () => {
    const { repository, create } = buildRepository();
    create.mockRejectedValue(
      Object.assign(
        new Error(
          'Unique constraint failed on the fields: (`warehouseId`,`productId`,`batchId`,`serialNumberId`)',
        ),
        { code: 'P2002' },
      ),
    );

    await expect(repository.create(buildStockData())).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('findById: constrains strictly by organizationId + id', async () => {
    const { repository, findFirst } = buildRepository();
    findFirst.mockResolvedValue(null);

    await repository.findById(ORG_A, 'stock-1');

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'stock-1', organizationId: ORG_A },
    });
  });

  it('findById: cross-organization stock is not visible under org A', async () => {
    const { repository, findFirst } = buildRepository();
    findFirst.mockImplementation(
      async (args: { where: Record<string, unknown> }) =>
        args.where.organizationId === ORG_B
          ? { id: 'stock-1', organizationId: ORG_B }
          : null,
    );

    await expect(repository.findById(ORG_A, 'stock-1')).resolves.toBeNull();
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

  it('update: scoped where (id + organizationId) with data passthrough', async () => {
    const { repository, update } = buildRepository();
    update.mockResolvedValue({ id: 'stock-1' });

    await repository.update(ORG_A, 'stock-1', {
      quantity: 7,
      batchId: null,
      serialNumberId: 'sn-7',
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'stock-1', organizationId: ORG_A },
      data: { quantity: 7, batchId: null, serialNumberId: 'sn-7' },
    });
  });

  it('exposes no delete method (stock rows are never removed by the repository)', () => {
    const { repository, model } = buildRepository();

    expect(
      (repository as unknown as Record<string, unknown>).delete,
    ).toBeUndefined();
    expect('delete' in model).toBe(false);
  });
});
