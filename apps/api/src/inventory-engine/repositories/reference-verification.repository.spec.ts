import { PrismaService } from '../../prisma/prisma.service';
import { PrismaBatchRepository } from './batch.repository';
import { PrismaInventoryTransactionRepository } from './inventory-transaction.repository';
import { PrismaOpeningStockRepository } from './opening-stock.repository';
import { PrismaSerialNumberRepository } from './serial-number.repository';
import { PrismaStockAdjustmentRepository } from './stock-adjustment.repository';
import { PrismaStockMovementRepository } from './stock-movement.repository';
import { PrismaStockReservationRepository } from './stock-reservation.repository';
import { PrismaStockRepository } from './stock.repository';
import { PrismaWarehouseTransferRepository } from './warehouse-transfer.repository';

const ORG_A = 'org-a';
const ORG_B = 'org-b';

type PrismaMock = Record<string, { findFirst: jest.Mock }>;

function buildPrisma(models: string[]): PrismaMock {
  const prisma: PrismaMock = {};
  for (const model of models) {
    prisma[model] = { findFirst: jest.fn().mockResolvedValue({ id: 'ref-1' }) };
  }
  return prisma;
}

const asService = (prisma: PrismaMock) => prisma as unknown as PrismaService;

describe('verifyReferences: organization-scoped reference integrity (repository layer)', () => {
  afterEach(() => jest.clearAllMocks());

  describe('PrismaBatchRepository', () => {
    it('accepts a same-org product with an organization-scoped, soft-delete-aware query', async () => {
      const prisma = buildPrisma(['product']);
      const repository = new PrismaBatchRepository(asService(prisma));

      await expect(repository.verifyReferences(ORG_A, { productId: 'prod-1' })).resolves.toBe(true);
      expect(prisma.product.findFirst).toHaveBeenCalledWith({
        where: { id: 'prod-1', organizationId: ORG_A, deletedAt: null },
        select: { id: true },
      });
    });

    it('rejects a cross-org product (foreign rows cannot satisfy the scoped where)', async () => {
      const prisma = buildPrisma(['product']);
      prisma.product.findFirst.mockImplementation(
        async (args: { where: { organizationId: string } }) =>
          args.where.organizationId === ORG_B ? { id: 'prod-1' } : null,
      );
      const repository = new PrismaBatchRepository(asService(prisma));

      await expect(repository.verifyReferences(ORG_A, { productId: 'prod-1' })).resolves.toBe(false);
      expect(prisma.product.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG_A }),
        }),
      );
    });

    it('skips querying entirely when no reference is supplied', async () => {
      const prisma = buildPrisma(['product']);
      const repository = new PrismaBatchRepository(asService(prisma));

      await expect(repository.verifyReferences(ORG_A, {})).resolves.toBe(true);
      expect(prisma.product.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('PrismaSerialNumberRepository', () => {
    it('accepts same-org product and batch references', async () => {
      const prisma = buildPrisma(['product', 'batch']);
      const repository = new PrismaSerialNumberRepository(asService(prisma));

      await expect(
        repository.verifyReferences(ORG_A, { productId: 'prod-1', batchId: 'batch-1' }),
      ).resolves.toBe(true);
      expect(prisma.product.findFirst).toHaveBeenCalledWith({
        where: { id: 'prod-1', organizationId: ORG_A, deletedAt: null },
        select: { id: true },
      });
      expect(prisma.batch.findFirst).toHaveBeenCalledWith({
        where: { id: 'batch-1', organizationId: ORG_A, deletedAt: null },
        select: { id: true },
      });
    });

    it('rejects a cross-org product even when the batch is valid', async () => {
      const prisma = buildPrisma(['product', 'batch']);
      prisma.product.findFirst.mockResolvedValue(null);
      const repository = new PrismaSerialNumberRepository(asService(prisma));

      await expect(
        repository.verifyReferences(ORG_A, { productId: 'prod-1', batchId: 'batch-1' }),
      ).resolves.toBe(false);
    });

    it('rejects a cross-org batch', async () => {
      const prisma = buildPrisma(['product', 'batch']);
      prisma.batch.findFirst.mockImplementation(
        async (args: { where: { organizationId: string } }) =>
          args.where.organizationId === ORG_B ? { id: 'batch-1' } : null,
      );
      const repository = new PrismaSerialNumberRepository(asService(prisma));

      await expect(
        repository.verifyReferences(ORG_A, { productId: 'prod-1', batchId: 'batch-1' }),
      ).resolves.toBe(false);
      expect(prisma.batch.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG_A }),
        }),
      );
    });
  });

  describe('PrismaStockRepository', () => {
    it('accepts same-org warehouse, product, batch and serial references', async () => {
      const prisma = buildPrisma(['warehouse', 'product', 'batch', 'serialNumber']);
      const repository = new PrismaStockRepository(asService(prisma));

      await expect(
        repository.verifyReferences(ORG_A, {
          warehouseId: 'wh-1',
          productId: 'prod-1',
          batchId: 'batch-1',
          serialNumberId: 'sn-1',
        }),
      ).resolves.toBe(true);
      expect(prisma.warehouse.findFirst).toHaveBeenCalledWith({
        where: { id: 'wh-1', organizationId: ORG_A },
        select: { id: true },
      });
      expect(prisma.product.findFirst).toHaveBeenCalledWith({
        where: { id: 'prod-1', organizationId: ORG_A, deletedAt: null },
        select: { id: true },
      });
      expect(prisma.batch.findFirst).toHaveBeenCalledWith({
        where: { id: 'batch-1', organizationId: ORG_A, deletedAt: null },
        select: { id: true },
      });
      expect(prisma.serialNumber.findFirst).toHaveBeenCalledWith({
        where: { id: 'sn-1', organizationId: ORG_A, deletedAt: null },
        select: { id: true },
      });
    });

    it.each([
      ['warehouse', 'warehouse'],
      ['product', 'product'],
      ['batch', 'batch'],
      ['serial', 'serialNumber'],
    ])('rejects a cross-org %s reference', async (_name, model) => {
      const prisma = buildPrisma(['warehouse', 'product', 'batch', 'serialNumber']);
      prisma[model].findFirst.mockResolvedValue(null);
      const repository = new PrismaStockRepository(asService(prisma));

      const result = await repository.verifyReferences(ORG_A, {
        warehouseId: 'wh-1',
        productId: 'prod-1',
        batchId: 'batch-1',
        serialNumberId: 'sn-1',
      });
      expect(result).toBe(false);
      expect(prisma[model].findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG_A }),
        }),
      );
    });

    it('skips optional references that are absent (undefined means unchanged/absent)', async () => {
      const prisma = buildPrisma(['warehouse', 'product', 'batch', 'serialNumber']);
      const repository = new PrismaStockRepository(asService(prisma));

      await expect(repository.verifyReferences(ORG_A, { batchId: undefined })).resolves.toBe(true);
      expect(prisma.warehouse.findFirst).not.toHaveBeenCalled();
      expect(prisma.product.findFirst).not.toHaveBeenCalled();
      expect(prisma.batch.findFirst).not.toHaveBeenCalled();
      expect(prisma.serialNumber.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('PrismaStockMovementRepository', () => {
    it('accepts a same-org stock reference', async () => {
      const prisma = buildPrisma(['stock']);
      const repository = new PrismaStockMovementRepository(asService(prisma));

      await expect(repository.verifyReferences(ORG_A, { stockId: 'st-1' })).resolves.toBe(true);
      expect(prisma.stock.findFirst).toHaveBeenCalledWith({
        where: { id: 'st-1', organizationId: ORG_A },
        select: { id: true },
      });
    });

    it('rejects a cross-org stock reference', async () => {
      const prisma = buildPrisma(['stock']);
      prisma.stock.findFirst.mockResolvedValue(null);
      const repository = new PrismaStockMovementRepository(asService(prisma));

      await expect(repository.verifyReferences(ORG_A, { stockId: 'st-1' })).resolves.toBe(false);
      expect(prisma.stock.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG_A }),
        }),
      );
    });
  });

  describe('PrismaStockReservationRepository', () => {
    it('accepts a same-org stock reference', async () => {
      const prisma = buildPrisma(['stock']);
      const repository = new PrismaStockReservationRepository(asService(prisma));

      await expect(repository.verifyReferences(ORG_A, { stockId: 'st-1' })).resolves.toBe(true);
      expect(prisma.stock.findFirst).toHaveBeenCalledWith({
        where: { id: 'st-1', organizationId: ORG_A },
        select: { id: true },
      });
    });

    it('rejects a cross-org stock reference', async () => {
      const prisma = buildPrisma(['stock']);
      prisma.stock.findFirst.mockResolvedValue(null);
      const repository = new PrismaStockReservationRepository(asService(prisma));

      await expect(repository.verifyReferences(ORG_A, { stockId: 'st-1' })).resolves.toBe(false);
    });
  });

  describe('PrismaStockAdjustmentRepository', () => {
    it('accepts a same-org stock reference', async () => {
      const prisma = buildPrisma(['stock']);
      const repository = new PrismaStockAdjustmentRepository(asService(prisma));

      await expect(repository.verifyReferences(ORG_A, { stockId: 'st-1' })).resolves.toBe(true);
      expect(prisma.stock.findFirst).toHaveBeenCalledWith({
        where: { id: 'st-1', organizationId: ORG_A },
        select: { id: true },
      });
    });

    it('rejects a cross-org stock reference', async () => {
      const prisma = buildPrisma(['stock']);
      prisma.stock.findFirst.mockResolvedValue(null);
      const repository = new PrismaStockAdjustmentRepository(asService(prisma));

      await expect(repository.verifyReferences(ORG_A, { stockId: 'st-1' })).resolves.toBe(false);
    });
  });

  describe('PrismaWarehouseTransferRepository', () => {
    it('accepts same-org source and destination warehouses with scoped queries', async () => {
      const prisma = buildPrisma(['warehouse']);
      const repository = new PrismaWarehouseTransferRepository(asService(prisma));

      await expect(
        repository.verifyReferences(ORG_A, { sourceWarehouseId: 'wh-1', destWarehouseId: 'wh-2' }),
      ).resolves.toBe(true);
      expect(prisma.warehouse.findFirst).toHaveBeenNthCalledWith(1, {
        where: { id: 'wh-1', organizationId: ORG_A },
        select: { id: true },
      });
      expect(prisma.warehouse.findFirst).toHaveBeenNthCalledWith(2, {
        where: { id: 'wh-2', organizationId: ORG_A },
        select: { id: true },
      });
    });

    it('rejects a cross-org source warehouse', async () => {
      const prisma = buildPrisma(['warehouse']);
      prisma.warehouse.findFirst.mockResolvedValueOnce(null);
      const repository = new PrismaWarehouseTransferRepository(asService(prisma));

      await expect(
        repository.verifyReferences(ORG_A, { sourceWarehouseId: 'wh-1', destWarehouseId: 'wh-2' }),
      ).resolves.toBe(false);
      expect(prisma.warehouse.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.warehouse.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'wh-1', organizationId: ORG_A },
        }),
      );
    });

    it('rejects a cross-org destination warehouse while the source is valid', async () => {
      const prisma = buildPrisma(['warehouse']);
      prisma.warehouse.findFirst
        .mockResolvedValueOnce({ id: 'wh-1' })
        .mockResolvedValueOnce(null);
      const repository = new PrismaWarehouseTransferRepository(asService(prisma));

      await expect(
        repository.verifyReferences(ORG_A, { sourceWarehouseId: 'wh-1', destWarehouseId: 'wh-2' }),
      ).resolves.toBe(false);
      expect(prisma.warehouse.findFirst).toHaveBeenCalledTimes(2);
      expect(prisma.warehouse.findFirst).toHaveBeenNthCalledWith(2, {
        where: { id: 'wh-2', organizationId: ORG_A },
        select: { id: true },
      });
    });
  });

  describe('PrismaOpeningStockRepository', () => {
    it('accepts same-org warehouse, product, batch and serial references', async () => {
      const prisma = buildPrisma(['warehouse', 'product', 'batch', 'serialNumber']);
      const repository = new PrismaOpeningStockRepository(asService(prisma));

      await expect(
        repository.verifyReferences(ORG_A, {
          warehouseId: 'wh-1',
          productId: 'prod-1',
          batchId: 'batch-1',
          serialNumberId: 'sn-1',
        }),
      ).resolves.toBe(true);
      expect(prisma.warehouse.findFirst).toHaveBeenCalledWith({
        where: { id: 'wh-1', organizationId: ORG_A },
        select: { id: true },
      });
    });

    it.each([
      ['warehouse', 'warehouse'],
      ['product', 'product'],
      ['batch', 'batch'],
      ['serial', 'serialNumber'],
    ])('rejects a cross-org %s reference', async (_name, model) => {
      const prisma = buildPrisma(['warehouse', 'product', 'batch', 'serialNumber']);
      prisma[model].findFirst.mockResolvedValue(null);
      const repository = new PrismaOpeningStockRepository(asService(prisma));

      const result = await repository.verifyReferences(ORG_A, {
        warehouseId: 'wh-1',
        productId: 'prod-1',
        batchId: 'batch-1',
        serialNumberId: 'sn-1',
      });
      expect(result).toBe(false);
      expect(prisma[model].findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG_A }),
        }),
      );
    });
  });

  describe('PrismaInventoryTransactionRepository', () => {
    it('accepts a same-org product reference', async () => {
      const prisma = buildPrisma(['product']);
      const repository = new PrismaInventoryTransactionRepository(asService(prisma));

      await expect(repository.verifyReferences(ORG_A, { productId: 'prod-1' })).resolves.toBe(true);
      expect(prisma.product.findFirst).toHaveBeenCalledWith({
        where: { id: 'prod-1', organizationId: ORG_A, deletedAt: null },
        select: { id: true },
      });
    });

    it('rejects a cross-org product reference', async () => {
      const prisma = buildPrisma(['product']);
      prisma.product.findFirst.mockImplementation(
        async (args: { where: { organizationId: string } }) =>
          args.where.organizationId === ORG_B ? { id: 'prod-1' } : null,
      );
      const repository = new PrismaInventoryTransactionRepository(asService(prisma));

      await expect(repository.verifyReferences(ORG_A, { productId: 'prod-1' })).resolves.toBe(false);
      expect(prisma.product.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG_A }),
        }),
      );
    });

    it('skips querying when no reference is supplied', async () => {
      const prisma = buildPrisma(['product']);
      const repository = new PrismaInventoryTransactionRepository(asService(prisma));

      await expect(repository.verifyReferences(ORG_A, {})).resolves.toBe(true);
      expect(prisma.product.findFirst).not.toHaveBeenCalled();
    });
  });
});
