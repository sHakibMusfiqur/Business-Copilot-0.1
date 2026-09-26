import { PrismaService } from '../../prisma/prisma.service';
import type { StockAdjustment } from '../interfaces';
import { PrismaStockAdjustmentRepository } from './stock-adjustment.repository';

const ORG_A = 'org-a';
const ORG_B = 'org-b';

type StockAdjustmentData = Omit<StockAdjustment, 'id' | 'createdAt'>;

function buildRepository() {
  const create = jest.fn();
  const findFirst = jest.fn();
  const findMany = jest.fn();
  const model = { create, findFirst, findMany };
  const prisma = { stockAdjustment: model } as unknown as PrismaService;
  const repository = new PrismaStockAdjustmentRepository(prisma);
  return { repository, model, create, findFirst, findMany };
}

function buildAdjustmentData(
  overrides: Partial<StockAdjustmentData> = {},
): StockAdjustmentData {
  return {
    organizationId: ORG_A,
    stockId: 'stock-1',
    adjustmentType: 'ADD',
    quantityBefore: 10,
    quantityAfter: 14,
    adjustmentQty: 4,
    reason: 'recount',
    notes: null,
    metadata: {},
    ...overrides,
  };
}

describe('PrismaStockAdjustmentRepository', () => {
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

  it('create: persists adjustmentType with quantityBefore/quantityAfter/adjustmentQty intact', async () => {
    const { repository, create } = buildRepository();
    const data = buildAdjustmentData();
    const created = { id: 'adj-1', ...data, createdAt: new Date() };
    create.mockResolvedValue(created);

    await expect(repository.create(data)).resolves.toEqual(created);
    expect(create).toHaveBeenCalledWith({ data });
    const passed = (create.mock.calls[0][0] as { data: StockAdjustmentData }).data;
    expect(passed.adjustmentType).toBe('ADD');
    expect(passed.quantityBefore).toBe(10);
    expect(passed.quantityAfter).toBe(14);
    expect(passed.adjustmentQty).toBe(4);
  });

  it('create: allows nullable reason/notes', async () => {
    const { repository, create } = buildRepository();
    const data = buildAdjustmentData({ reason: null, notes: null });
    create.mockResolvedValue({ id: 'adj-2', ...data, createdAt: new Date() });

    await repository.create(data);

    const passed = (create.mock.calls[0][0] as { data: StockAdjustmentData }).data;
    expect(passed.reason).toBeNull();
    expect(passed.notes).toBeNull();
  });

  it('findById: constrains by organizationId + id', async () => {
    const { repository, findFirst } = buildRepository();
    findFirst.mockResolvedValue(null);

    await repository.findById(ORG_A, 'adj-1');

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'adj-1', organizationId: ORG_A },
    });
  });

  it('findById: cross-organization adjustment is not visible under org A', async () => {
    const { repository, findFirst } = buildRepository();
    findFirst.mockImplementation(
      async (args: { where: Record<string, unknown> }) =>
        args.where.organizationId === ORG_B
          ? { id: 'adj-1', organizationId: ORG_B }
          : null,
    );

    await expect(repository.findById(ORG_A, 'adj-1')).resolves.toBeNull();
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
