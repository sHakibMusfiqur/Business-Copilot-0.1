import { PrismaService } from '../../prisma/prisma.service';
import type { SerialNumber } from '../interfaces';
import { PrismaSerialNumberRepository } from './serial-number.repository';

const ORG_A = 'org-a';
const ORG_B = 'org-b';

type SerialNumberData = Omit<SerialNumber, 'id' | 'createdAt' | 'updatedAt'>;

function buildRepository() {
  const create = jest.fn();
  const findFirst = jest.fn();
  const findMany = jest.fn();
  const update = jest.fn();
  const model = { create, findFirst, findMany, update };
  const prisma = { serialNumber: model } as unknown as PrismaService;
  const repository = new PrismaSerialNumberRepository(prisma);
  return { repository, model, create, findFirst, findMany, update };
}

function buildSerialNumberData(
  overrides: Partial<SerialNumberData> = {},
): SerialNumberData {
  return {
    organizationId: ORG_A,
    productId: 'prod-1',
    batchId: null,
    serialNumber: 'SN-0001',
    status: 'AVAILABLE',
    metadata: {},
    deletedAt: null,
    ...overrides,
  };
}

describe('PrismaSerialNumberRepository', () => {
  afterEach(() => jest.clearAllMocks());

  it('create: passes data through including optional (nullable) batchId', async () => {
    const { repository, create } = buildRepository();
    const data = buildSerialNumberData({ batchId: null });
    const created = { id: 'sn-1', ...data, createdAt: new Date(), updatedAt: new Date() };
    create.mockResolvedValue(created);

    await expect(repository.create(data)).resolves.toEqual(created);
    expect(create).toHaveBeenCalledWith({ data });
    expect((create.mock.calls[0][0] as { data: { batchId: string | null } }).data.batchId).toBeNull();
  });

  it('create: propagates unique-constraint failure (P2002) on organization + product + serialNumber', async () => {
    const { repository, create } = buildRepository();
    create.mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
    );

    await expect(repository.create(buildSerialNumberData())).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('findById: constrains by organizationId and excludes soft-deleted rows', async () => {
    const { repository, findFirst } = buildRepository();
    findFirst.mockResolvedValue(null);

    await repository.findById(ORG_A, 'sn-1');

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'sn-1', organizationId: ORG_A, deletedAt: null },
    });
  });

  it('findById: cross-organization record is not visible under org A', async () => {
    const { repository, findFirst } = buildRepository();
    findFirst.mockImplementation(
      async (args: { where: Record<string, unknown> }) =>
        args.where.organizationId === ORG_B
          ? { id: 'sn-1', organizationId: ORG_B }
          : null,
    );

    await expect(repository.findById(ORG_A, 'sn-1')).resolves.toBeNull();
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

  it('update: scoped where with data passthrough (nullable batchId can be changed)', async () => {
    const { repository, update } = buildRepository();
    update.mockResolvedValue({ id: 'sn-1' });

    await repository.update(ORG_A, 'sn-1', { batchId: 'batch-9', status: 'SOLD' });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'sn-1', organizationId: ORG_A, deletedAt: null },
      data: { batchId: 'batch-9', status: 'SOLD' },
    });
  });

  it('delete: performs a scoped soft delete, never a hard delete', async () => {
    const { repository, model, update } = buildRepository();
    update.mockResolvedValue({ id: 'sn-1' });

    await repository.delete(ORG_A, 'sn-1');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'sn-1', organizationId: ORG_A, deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
    expect('delete' in model).toBe(false);
  });
});
