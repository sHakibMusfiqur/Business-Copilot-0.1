import { PrismaService } from '../../prisma/prisma.service';
import type { StockReservation } from '../interfaces';
import { PrismaStockReservationRepository } from './stock-reservation.repository';

const ORG_A = 'org-a';
const ORG_B = 'org-b';

type StockReservationData = Omit<
  StockReservation,
  'id' | 'createdAt' | 'updatedAt'
>;

function buildRepository() {
  const create = jest.fn();
  const findFirst = jest.fn();
  const findMany = jest.fn();
  const update = jest.fn();
  const model = { create, findFirst, findMany, update };
  const prisma = { stockReservation: model } as unknown as PrismaService;
  const repository = new PrismaStockReservationRepository(prisma);
  return { repository, model, create, findFirst, findMany, update };
}

function buildReservationData(
  overrides: Partial<StockReservationData> = {},
): StockReservationData {
  return {
    organizationId: ORG_A,
    stockId: 'stock-1',
    quantity: 5,
    reservedQuantity: 5,
    status: 'PENDING',
    referenceType: 'SALES_ORDER',
    referenceId: 'so-77',
    notes: null,
    expiresAt: new Date('2026-10-01T00:00:00.000Z'),
    metadata: {},
    ...overrides,
  };
}

describe('PrismaStockReservationRepository', () => {
  afterEach(() => jest.clearAllMocks());

  it('create: persists status, expiresAt and referenceType/referenceId pair', async () => {
    const { repository, create } = buildRepository();
    const data = buildReservationData();
    const created = { id: 'res-1', ...data, createdAt: new Date(), updatedAt: new Date() };
    create.mockResolvedValue(created);

    await expect(repository.create(data)).resolves.toEqual(created);
    expect(create).toHaveBeenCalledWith({ data });
    const passed = (create.mock.calls[0][0] as { data: StockReservationData }).data;
    expect(passed.status).toBe('PENDING');
    expect(passed.expiresAt).toEqual(new Date('2026-10-01T00:00:00.000Z'));
    expect(passed.referenceType).toBe('SALES_ORDER');
    expect(passed.referenceId).toBe('so-77');
  });

  it('create: allows nullable reference pair and expiresAt', async () => {
    const { repository, create } = buildRepository();
    const data = buildReservationData({
      referenceType: null,
      referenceId: null,
      expiresAt: null,
    });
    create.mockResolvedValue({ id: 'res-2', ...data, createdAt: new Date(), updatedAt: new Date() });

    await repository.create(data);

    const passed = (create.mock.calls[0][0] as { data: StockReservationData }).data;
    expect(passed.referenceType).toBeNull();
    expect(passed.referenceId).toBeNull();
    expect(passed.expiresAt).toBeNull();
  });

  it('findById: constrains by organizationId + id', async () => {
    const { repository, findFirst } = buildRepository();
    findFirst.mockResolvedValue(null);

    await repository.findById(ORG_A, 'res-1');

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'res-1', organizationId: ORG_A },
    });
  });

  it('findById: cross-organization reservation is not visible under org A', async () => {
    const { repository, findFirst } = buildRepository();
    findFirst.mockImplementation(
      async (args: { where: Record<string, unknown> }) =>
        args.where.organizationId === ORG_B
          ? { id: 'res-1', organizationId: ORG_B }
          : null,
    );

    await expect(repository.findById(ORG_A, 'res-1')).resolves.toBeNull();
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
    update.mockResolvedValue({ id: 'res-1' });

    await repository.update(ORG_A, 'res-1', {
      status: 'FULFILLED',
      reservedQuantity: 5,
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'res-1', organizationId: ORG_A },
      data: { status: 'FULFILLED', reservedQuantity: 5 },
    });
  });

  it('exposes no delete method (reservations are released via status, not deletion)', () => {
    const { repository, model } = buildRepository();

    expect(
      (repository as unknown as Record<string, unknown>).delete,
    ).toBeUndefined();
    expect('delete' in model).toBe(false);
  });
});
