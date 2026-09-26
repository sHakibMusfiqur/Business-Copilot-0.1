import { PrismaService } from '../../prisma/prisma.service';
import type { WarehouseTransfer } from '../interfaces';
import { PrismaWarehouseTransferRepository } from './warehouse-transfer.repository';

const ORG_A = 'org-a';
const ORG_B = 'org-b';

type WarehouseTransferData = Omit<
  WarehouseTransfer,
  'id' | 'createdAt' | 'updatedAt'
>;

function buildRepository() {
  const create = jest.fn();
  const findFirst = jest.fn();
  const findMany = jest.fn();
  const update = jest.fn();
  const model = { create, findFirst, findMany, update };
  const prisma = { warehouseTransfer: model } as unknown as PrismaService;
  const repository = new PrismaWarehouseTransferRepository(prisma);
  return { repository, model, create, findFirst, findMany, update };
}

function buildTransferData(
  overrides: Partial<WarehouseTransferData> = {},
): WarehouseTransferData {
  return {
    organizationId: ORG_A,
    sourceWarehouseId: 'wh-src',
    destWarehouseId: 'wh-dst',
    transferNumber: 'TRF-0001',
    status: 'DRAFT',
    notes: null,
    metadata: {},
    deletedAt: null,
    ...overrides,
  };
}

describe('PrismaWarehouseTransferRepository', () => {
  afterEach(() => jest.clearAllMocks());

  it('create: passes named source/destination relations, status and transferNumber', async () => {
    const { repository, create } = buildRepository();
    const data = buildTransferData();
    const created = { id: 'trf-1', ...data, createdAt: new Date(), updatedAt: new Date() };
    create.mockResolvedValue(created);

    await expect(repository.create(data)).resolves.toEqual(created);
    expect(create).toHaveBeenCalledWith({ data });
    const passed = (create.mock.calls[0][0] as { data: WarehouseTransferData }).data;
    expect(passed.sourceWarehouseId).toBe('wh-src');
    expect(passed.destWarehouseId).toBe('wh-dst');
    expect(passed.status).toBe('DRAFT');
    expect(passed.transferNumber).toBe('TRF-0001');
  });

  it('create: propagates unique-constraint failure on organization + transferNumber', async () => {
    const { repository, create } = buildRepository();
    create.mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2022' }),
    );

    await expect(repository.create(buildTransferData())).rejects.toMatchObject({
      code: 'P2022',
    });
  });

  it('findById: constrains by organizationId and excludes soft-deleted rows', async () => {
    const { repository, findFirst } = buildRepository();
    findFirst.mockResolvedValue(null);

    await repository.findById(ORG_A, 'trf-1');

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'trf-1', organizationId: ORG_A, deletedAt: null },
    });
  });

  it('findById: cross-organization transfer is not visible under org A', async () => {
    const { repository, findFirst } = buildRepository();
    findFirst.mockImplementation(
      async (args: { where: Record<string, unknown> }) =>
        args.where.organizationId === ORG_B
          ? { id: 'trf-1', organizationId: ORG_B }
          : null,
    );

    await expect(repository.findById(ORG_A, 'trf-1')).resolves.toBeNull();
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
    update.mockResolvedValue({ id: 'trf-1' });

    await repository.update(ORG_A, 'trf-1', { status: 'APPROVED' });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'trf-1', organizationId: ORG_A, deletedAt: null },
      data: { status: 'APPROVED' },
    });
  });

  it('delete: performs a scoped soft delete, never a hard delete', async () => {
    const { repository, model, update } = buildRepository();
    update.mockResolvedValue({ id: 'trf-1' });

    await repository.delete(ORG_A, 'trf-1');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'trf-1', organizationId: ORG_A, deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
    expect('delete' in model).toBe(false);
  });
});
