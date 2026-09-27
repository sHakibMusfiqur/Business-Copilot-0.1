import { ConflictException, NotFoundException } from '@nestjs/common';
import { BatchStatus, Prisma } from '@prisma/client';

import { BatchService } from './batch.service';
import type { BatchRepository } from './interfaces/batch-repository.interface';
import type { AuditService } from '../audit/audit.service';

const ORG_ID = 'org-1';
const OTHER_ORG = 'org-2';
const USER_ID = 'user-1';

const p2002 = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6.0.0',
    meta: {},
  });

const p2025 = () =>
  new Prisma.PrismaClientKnownRequestError('Record not found', {
    code: 'P2025',
    clientVersion: '6.0.0',
    meta: {},
  });

const buildBatch = (overrides: Record<string, unknown> = {}) => ({
  id: 'b1',
  organizationId: ORG_ID,
  productId: 'p1',
  batchNumber: 'B-001',
  manufacturingDate: null,
  expiryDate: null,
  status: BatchStatus.ACTIVE,
  metadata: {},
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  deletedAt: null,
  ...overrides,
});

const buildService = (overrides: Record<string, jest.Mock> = {}) => {
  const findById = overrides.findById ?? jest.fn();
  const findByOrganization = overrides.findByOrganization ?? jest.fn().mockResolvedValue([]);
  const create = overrides.create ?? jest.fn();
  const update = overrides.update ?? jest.fn();
  const deleteFn = overrides.delete ?? jest.fn().mockResolvedValue(undefined);
  const auditRecord = overrides.auditRecord ?? jest.fn().mockResolvedValue(undefined);

  const service = new BatchService(
    { findById, findByOrganization, create, update, delete: deleteFn } as unknown as BatchRepository,
    { record: auditRecord } as unknown as AuditService,
  );

  return { service, findById, findByOrganization, create, update, deleteFn, auditRecord };
};

describe('BatchService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('creates a batch scoped to the server-derived organization', async () => {
      const { service, create, auditRecord } = buildService();
      create.mockResolvedValue(buildBatch());

      const result = await service.create(ORG_ID, USER_ID, {
        productId: 'p1',
        batchNumber: '  B-001  ',
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ORG_ID,
          productId: 'p1',
          batchNumber: 'B-001',
          status: BatchStatus.ACTIVE,
          deletedAt: null,
        }),
      );
      expect(result.id).toBe('b1');
      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          organizationId: ORG_ID,
          action: 'BATCH_CREATED',
          entity: 'Batch',
          entityId: 'b1',
        }),
      );
    });

    it('converts optional dates and passes metadata', async () => {
      const { service, create } = buildService();
      create.mockResolvedValue(buildBatch());

      await service.create(ORG_ID, USER_ID, {
        productId: 'p1',
        batchNumber: 'B-001',
        manufacturingDate: '2026-01-05',
        expiryDate: '2026-12-31',
        metadata: { origin: 'plant-1' },
      });

      const data = create.mock.calls[0][0];
      expect(data.manufacturingDate).toEqual(new Date('2026-01-05'));
      expect(data.expiryDate).toEqual(new Date('2026-12-31'));
      expect(data.metadata).toEqual({ origin: 'plant-1' });
    });

    it('translates unique-constraint failure (P2002) into ConflictException', async () => {
      const { service, create, auditRecord } = buildService();
      create.mockRejectedValue(p2002());

      await expect(
        service.create(ORG_ID, USER_ID, { productId: 'p1', batchNumber: 'B-001' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(auditRecord).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns a batch within the organization scope', async () => {
      const { service, findById } = buildService();
      findById.mockResolvedValue(buildBatch());

      const result = await service.findById(ORG_ID, 'b1');

      expect(findById).toHaveBeenCalledWith(ORG_ID, 'b1');
      expect(result.id).toBe('b1');
    });

    it('throws NotFoundException for cross-organization or missing records', async () => {
      const { service, findById } = buildService();
      findById.mockResolvedValue(null);

      await expect(service.findById(OTHER_ORG, 'b1')).rejects.toBeInstanceOf(NotFoundException);
      expect(findById).toHaveBeenCalledWith(OTHER_ORG, 'b1');
    });

    it('throws NotFoundException for soft-deleted records (repository excludes them)', async () => {
      const { service, findById } = buildService();
      findById.mockResolvedValue(null);

      await expect(service.findById(ORG_ID, 'b1')).rejects.toThrow('Batch not found');
    });
  });

  describe('findAll', () => {
    it('returns paginated results scoped to the organization', async () => {
      const { service, findByOrganization } = buildService();
      findByOrganization.mockResolvedValue([buildBatch(), buildBatch({ id: 'b2', batchNumber: 'B-002' })]);

      const result = await service.findAll(ORG_ID, {});

      expect(findByOrganization).toHaveBeenCalledWith(ORG_ID);
      expect(result.meta).toEqual({ total: 2, page: 1, limit: 10, totalPages: 1 });
      expect(result.data).toHaveLength(2);
    });

    it('applies search on batchNumber and status filter', async () => {
      const { service, findByOrganization } = buildService();
      findByOrganization.mockResolvedValue([
        buildBatch(),
        buildBatch({ id: 'b2', batchNumber: 'OTHER-9' }),
        buildBatch({ id: 'b3', batchNumber: 'B-003', status: BatchStatus.EXPIRED }),
      ]);

      const result = await service.findAll(ORG_ID, { search: 'b-00' });
      expect(result.data.map((row) => row.id)).toEqual(['b1', 'b3']);

      const byStatus = await service.findAll(ORG_ID, { status: BatchStatus.EXPIRED });
      expect(byStatus.data.map((row) => row.id)).toEqual(['b3']);
    });

    it('paginates with page and limit', async () => {
      const { service, findByOrganization } = buildService();
      findByOrganization.mockResolvedValue([
        buildBatch({ id: 'b1', batchNumber: 'A' }),
        buildBatch({ id: 'b2', batchNumber: 'B' }),
        buildBatch({ id: 'b3', batchNumber: 'C' }),
      ]);

      const result = await service.findAll(ORG_ID, { page: 2, limit: 2 });

      expect(result.data.map((row) => row.id)).toEqual(['b3']);
      expect(result.meta).toEqual({ total: 3, page: 2, limit: 2, totalPages: 2 });
    });
  });

  describe('update', () => {
    it('updates allowed fields within the organization scope', async () => {
      const { service, update, auditRecord } = buildService();
      update.mockResolvedValue(buildBatch({ status: BatchStatus.DEPLETED }));

      const result = await service.update(ORG_ID, USER_ID, 'b1', { status: BatchStatus.DEPLETED });

      expect(update).toHaveBeenCalledWith(ORG_ID, 'b1', { status: BatchStatus.DEPLETED });
      expect(result.status).toBe(BatchStatus.DEPLETED);
      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'BATCH_UPDATED', organizationId: ORG_ID }),
      );
    });

    it('translates P2025 into NotFoundException', async () => {
      const { service, update } = buildService();
      update.mockRejectedValue(p2025());

      await expect(service.update(ORG_ID, USER_ID, 'b1', { status: BatchStatus.EXPIRED })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('translates unique-constraint failure (P2002) into ConflictException', async () => {
      const { service, update } = buildService();
      update.mockRejectedValue(p2002());

      await expect(service.update(ORG_ID, USER_ID, 'b1', { batchNumber: 'B-001' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('softDelete', () => {
    it('soft-deletes within the organization scope and audits', async () => {
      const { service, deleteFn, auditRecord } = buildService();

      const result = await service.softDelete(ORG_ID, USER_ID, 'b1');

      expect(deleteFn).toHaveBeenCalledWith(ORG_ID, 'b1');
      expect(result).toEqual({ message: 'Batch deleted successfully' });
      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'BATCH_DELETED', organizationId: ORG_ID, entityId: 'b1' }),
      );
    });

    it('translates P2025 into NotFoundException for missing/cross-org/already-deleted records', async () => {
      const { service, deleteFn } = buildService();
      deleteFn.mockRejectedValue(p2025());

      await expect(service.softDelete(OTHER_ORG, USER_ID, 'b1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
