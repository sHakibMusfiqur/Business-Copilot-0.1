import { PrismaService } from '../../prisma/prisma.service';
import type { Batch } from '../interfaces';
import { PrismaBatchRepository } from './batch.repository';

const ORG_A = 'org-a';
const ORG_B = 'org-b';

type BatchData = Omit<Batch, 'id' | 'createdAt' | 'updatedAt'>;

function buildRepository() {
  const create = jest.fn();
  const findFirst = jest.fn();
  const findMany = jest.fn();
  const update = jest.fn();
  const model = { create, findFirst, findMany, update };
  const prisma = { batch: model } as unknown as PrismaService;
  const repository = new PrismaBatchRepository(prisma);
  return { repository, model, create, findFirst, findMany, update };
}

function buildBatchData(overrides: Partial<BatchData> = {}): BatchData {
  return {
    organizationId: ORG_A,
    productId: 'prod-1',
    batchNumber: 'BATCH-001',
    manufacturingDate: null,
    expiryDate: null,
    status: 'ACTIVE',
    metadata: {},
    deletedAt: null,
    ...overrides,
  };
}

describe('PrismaBatchRepository', () => {
  afterEach(() => jest.clearAllMocks());

  it('create: passes organization-scoped data through and returns the record', async () => {
    const { repository, create } = buildRepository();
    const data = buildBatchData();
    const created = { id: 'batch-1', ...data, createdAt: new Date(), updatedAt: new Date() };
    create.mockResolvedValue(created);

    await expect(repository.create(data)).resolves.toEqual(created);
    expect(create).toHaveBeenCalledWith({ data });
  });

  it('create: propagates unique-constraint failure on organization + product + batchNumber', async () => {
    const { repository, create } = buildRepository();
    create.mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2022' }),
    );

    await expect(repository.create(buildBatchData())).rejects.toMatchObject({
      code: 'P2022',
    });
  });

  it('findById: constrains by organizationId and excludes soft-deleted rows', async () => {
    const { repository, findFirst } = buildRepository();
    findFirst.mockResolvedValue(null);

    await repository.findById(ORG_A, 'batch-1');

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'batch-1', organizationId: ORG_A, deletedAt: null },
    });
  });

  it('findById: cross-organization record is not visible under org A', async () => {
    const { repository, findFirst } = buildRepository();
    findFirst.mockImplementation(
      async (args: { where: Record<string, unknown> }) =>
        args.where.organizationId === ORG_B
          ? { id: 'batch-1', organizationId: ORG_B }
          : null,
    );

    await expect(repository.findById(ORG_A, 'batch-1')).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: ORG_A }),
      }),
    );
  });

  it('findByOrganization: scoped to organization and excludes soft-deleted rows', async () => {
    const { repository, findMany } = buildRepository();
    findMany.mockResolvedValue([]);

    await repository.findByOrganization(ORG_A);

    expect(findMany).toHaveBeenCalledWith({
      where: { organizationId: ORG_A, deletedAt: null },
    });
  });

  it('update: scoped where (id + organizationId + not deleted) with data passthrough', async () => {
    const { repository, update } = buildRepository();
    update.mockResolvedValue({ id: 'batch-1' });

    await repository.update(ORG_A, 'batch-1', { status: 'EXPIRED' });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'batch-1', organizationId: ORG_A, deletedAt: null },
      data: { status: 'EXPIRED' },
    });
  });

  it('update: cross-organization update surfaces Prisma not-found (P2025)', async () => {
    const { repository, update } = buildRepository();
    update.mockRejectedValue(
      Object.assign(new Error('Record not found'), { code: 'P2025' }),
    );

    await expect(repository.update(ORG_A, 'batch-1', { status: 'EXPIRED' })).rejects.toMatchObject({
      code: 'P2025',
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: ORG_A }),
      }),
    );
  });

  it('delete: performs a scoped soft delete (deletedAt = now), never a hard delete', async () => {
    const { repository, model, update } = buildRepository();
    update.mockResolvedValue({ id: 'batch-1' });

    await repository.delete(ORG_A, 'batch-1');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'batch-1', organizationId: ORG_A, deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
    expect('delete' in model).toBe(false);
  });
});
