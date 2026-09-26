import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { StockMovement } from '../interfaces';
import { PrismaStockMovementRepository } from './stock-movement.repository';

const ORG_A = 'org-a';
const ORG_B = 'org-b';

type StockMovementData = Omit<StockMovement, 'id' | 'createdAt'>;

function buildRepository() {
  const create = jest.fn();
  const findFirst = jest.fn();
  const findMany = jest.fn();
  const model = { create, findFirst, findMany };
  const prisma = { stockMovement: model } as unknown as PrismaService;
  const repository = new PrismaStockMovementRepository(prisma);
  return { repository, model, create, findFirst, findMany };
}

function buildMovementData(
  overrides: Partial<StockMovementData> = {},
): StockMovementData {
  return {
    organizationId: ORG_A,
    stockId: 'stock-1',
    movementType: 'PURCHASE',
    quantity: 25,
    unitCost: new Prisma.Decimal('4.00'),
    totalCost: new Prisma.Decimal('100.00'),
    referenceType: 'PURCHASE_ORDER',
    referenceId: 'po-42',
    notes: null,
    metadata: {},
    ...overrides,
  };
}

describe('PrismaStockMovementRepository', () => {
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

  it('create: persists movementType with referenceType/referenceId pair intact', async () => {
    const { repository, create } = buildRepository();
    const data = buildMovementData();
    const created = { id: 'mv-1', ...data, createdAt: new Date() };
    create.mockResolvedValue(created);

    await expect(repository.create(data)).resolves.toEqual(created);
    expect(create).toHaveBeenCalledWith({ data });
    const passed = (create.mock.calls[0][0] as { data: StockMovementData }).data;
    expect(passed.movementType).toBe('PURCHASE');
    expect(passed.referenceType).toBe('PURCHASE_ORDER');
    expect(passed.referenceId).toBe('po-42');
  });

  it('create: allows nullable reference pair and notes to be null', async () => {
    const { repository, create } = buildRepository();
    const data = buildMovementData({
      referenceType: null,
      referenceId: null,
      notes: null,
    });
    create.mockResolvedValue({ id: 'mv-2', ...data, createdAt: new Date() });

    await repository.create(data);

    const passed = (create.mock.calls[0][0] as { data: StockMovementData }).data;
    expect(passed.referenceType).toBeNull();
    expect(passed.referenceId).toBeNull();
  });

  it('findById: constrains by organizationId + id', async () => {
    const { repository, findFirst } = buildRepository();
    findFirst.mockResolvedValue(null);

    await repository.findById(ORG_A, 'mv-1');

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'mv-1', organizationId: ORG_A },
    });
  });

  it('findById: cross-organization movement is not visible under org A', async () => {
    const { repository, findFirst } = buildRepository();
    findFirst.mockImplementation(
      async (args: { where: Record<string, unknown> }) =>
        args.where.organizationId === ORG_B
          ? { id: 'mv-1', organizationId: ORG_B }
          : null,
    );

    await expect(repository.findById(ORG_A, 'mv-1')).resolves.toBeNull();
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
