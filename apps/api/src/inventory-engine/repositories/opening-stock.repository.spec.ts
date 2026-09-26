import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { OpeningStock } from '../interfaces';
import { PrismaOpeningStockRepository } from './opening-stock.repository';

const ORG_A = 'org-a';
const ORG_B = 'org-b';

type OpeningStockData = Omit<OpeningStock, 'id' | 'createdAt'>;

function buildRepository() {
  const create = jest.fn();
  const findFirst = jest.fn();
  const findMany = jest.fn();
  const update = jest.fn();
  const model = { create, findFirst, findMany, update };
  const prisma = { openingStock: model } as unknown as PrismaService;
  const repository = new PrismaOpeningStockRepository(prisma);
  return { repository, model, create, findFirst, findMany, update };
}

function buildOpeningStockData(
  overrides: Partial<OpeningStockData> = {},
): OpeningStockData {
  return {
    organizationId: ORG_A,
    warehouseId: 'wh-1',
    productId: 'prod-1',
    batchId: null,
    serialNumberId: null,
    quantity: 100,
    unitCost: new Prisma.Decimal('2.25'),
    totalValue: new Prisma.Decimal('225.00'),
    referenceDate: new Date('2026-09-01T00:00:00.000Z'),
    notes: null,
    metadata: {},
    ...overrides,
  };
}

describe('PrismaOpeningStockRepository', () => {
  afterEach(() => jest.clearAllMocks());

  it('create: standalone record with nullable batchId/serialNumberId and no stockId', async () => {
    const { repository, create } = buildRepository();
    const data = buildOpeningStockData({ batchId: null, serialNumberId: null });
    const created = { id: 'os-1', ...data, createdAt: new Date() };
    create.mockResolvedValue(created);

    await expect(repository.create(data)).resolves.toEqual(created);
    expect(create).toHaveBeenCalledWith({ data });
    const passed = create.mock.calls[0][0] as { data: OpeningStockData & Record<string, unknown> };
    expect(passed.data.batchId).toBeNull();
    expect(passed.data.serialNumberId).toBeNull();
    expect('stockId' in passed.data).toBe(false);
    expect('stock' in passed.data).toBe(false);
  });

  it('create: references an explicit batch/serial when provided', async () => {
    const { repository, create } = buildRepository();
    const data = buildOpeningStockData({
      batchId: 'batch-3',
      serialNumberId: 'sn-3',
    });
    create.mockResolvedValue({ id: 'os-2', ...data, createdAt: new Date() });

    await repository.create(data);

    const passed = (create.mock.calls[0][0] as { data: OpeningStockData }).data;
    expect(passed.batchId).toBe('batch-3');
    expect(passed.serialNumberId).toBe('sn-3');
  });

  it('findById: constrains by organizationId + id', async () => {
    const { repository, findFirst } = buildRepository();
    findFirst.mockResolvedValue(null);

    await repository.findById(ORG_A, 'os-1');

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'os-1', organizationId: ORG_A },
    });
  });

  it('findById: cross-organization opening stock is not visible under org A', async () => {
    const { repository, findFirst } = buildRepository();
    findFirst.mockImplementation(
      async (args: { where: Record<string, unknown> }) =>
        args.where.organizationId === ORG_B
          ? { id: 'os-1', organizationId: ORG_B }
          : null,
    );

    await expect(repository.findById(ORG_A, 'os-1')).resolves.toBeNull();
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

  it('update: scoped where (id + organizationId) with data passthrough and no stockId', async () => {
    const { repository, update } = buildRepository();
    update.mockResolvedValue({ id: 'os-1' });

    await repository.update(ORG_A, 'os-1', { quantity: 90 });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'os-1', organizationId: ORG_A },
      data: { quantity: 90 },
    });
    const passed = update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect('stockId' in passed.data).toBe(false);
  });

  it('exposes no delete method (opening stock rows are not removed)', () => {
    const { repository, model } = buildRepository();

    expect(
      (repository as unknown as Record<string, unknown>).delete,
    ).toBeUndefined();
    expect('delete' in model).toBe(false);
  });
});
