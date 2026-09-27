import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, TransferStatus } from '@prisma/client';

import { WarehouseTransferService } from './warehouse-transfer.service';
import type { WarehouseTransferRepository } from './interfaces/warehouse-transfer-repository.interface';
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

const buildTransfer = (overrides: Record<string, unknown> = {}) => ({
  id: 'wt1',
  organizationId: ORG_ID,
  sourceWarehouseId: 'w1',
  destWarehouseId: 'w2',
  transferNumber: 'TR-001',
  status: TransferStatus.DRAFT,
  notes: null,
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
  const verifyReferences = overrides.verifyReferences ?? jest.fn().mockResolvedValue(true);
  const auditRecord = overrides.auditRecord ?? jest.fn().mockResolvedValue(undefined);

  const service = new WarehouseTransferService(
    { findById, findByOrganization, create, update, delete: deleteFn, verifyReferences } as unknown as WarehouseTransferRepository,
    { record: auditRecord } as unknown as AuditService,
  );

  return { service, findById, findByOrganization, create, update, deleteFn, verifyReferences, auditRecord };
};

describe('WarehouseTransferService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('creates a transfer scoped to the organization preserving source/destination ids', async () => {
      const { service, create, auditRecord } = buildService();
      create.mockResolvedValue(buildTransfer());

      const result = await service.create(ORG_ID, USER_ID, {
        sourceWarehouseId: 'w1',
        destWarehouseId: 'w2',
        transferNumber: ' TR-001 ',
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ORG_ID,
          sourceWarehouseId: 'w1',
          destWarehouseId: 'w2',
          transferNumber: 'TR-001',
          status: TransferStatus.DRAFT,
          deletedAt: null,
        }),
      );
      expect(result.transferNumber).toBe('TR-001');
      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'WAREHOUSE_TRANSFER_CREATED', organizationId: ORG_ID }),
      );
    });

    it('translates uniqueness handling (P2002) into ConflictException', async () => {
      const { service, create, auditRecord } = buildService();
      create.mockRejectedValue(p2002());

      await expect(
        service.create(ORG_ID, USER_ID, {
          sourceWarehouseId: 'w1',
          destWarehouseId: 'w2',
          transferNumber: 'TR-001',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(auditRecord).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns a transfer within the organization scope', async () => {
      const { service, findById } = buildService();
      findById.mockResolvedValue(buildTransfer());

      const result = await service.findById(ORG_ID, 'wt1');

      expect(findById).toHaveBeenCalledWith(ORG_ID, 'wt1');
      expect(result.sourceWarehouseId).toBe('w1');
      expect(result.destWarehouseId).toBe('w2');
    });

    it('throws NotFoundException for cross-organization access', async () => {
      const { service, findById } = buildService();
      findById.mockResolvedValue(null);

      await expect(service.findById(OTHER_ORG, 'wt1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('returns paginated results scoped to the organization with search and status filters', async () => {
      const { service, findByOrganization } = buildService();
      findByOrganization.mockResolvedValue([
        buildTransfer(),
        buildTransfer({ id: 'wt2', transferNumber: 'OTHER-9' }),
        buildTransfer({ id: 'wt3', transferNumber: 'TR-003', status: TransferStatus.COMPLETED }),
      ]);

      const all = await service.findAll(ORG_ID, {});
      expect(findByOrganization).toHaveBeenCalledWith(ORG_ID);
      expect(all.meta).toEqual({ total: 3, page: 1, limit: 10, totalPages: 1 });

      const searched = await service.findAll(ORG_ID, { search: 'tr-00' });
      expect(searched.data.map((row) => row.id)).toEqual(['wt1', 'wt3']);

      const byStatus = await service.findAll(ORG_ID, { status: TransferStatus.COMPLETED });
      expect(byStatus.data.map((row) => row.id)).toEqual(['wt3']);
    });
  });

  describe('update', () => {
    it('updates transfer status within the organization scope', async () => {
      const { service, update, auditRecord } = buildService();
      update.mockResolvedValue(buildTransfer({ status: TransferStatus.APPROVED }));

      const result = await service.update(ORG_ID, USER_ID, 'wt1', { status: TransferStatus.APPROVED });

      expect(update).toHaveBeenCalledWith(ORG_ID, 'wt1', { status: TransferStatus.APPROVED });
      expect(result.status).toBe(TransferStatus.APPROVED);
      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'WAREHOUSE_TRANSFER_UPDATED', organizationId: ORG_ID }),
      );
    });

    it('translates P2025 into NotFoundException', async () => {
      const { service, update } = buildService();
      update.mockRejectedValue(p2025());

      await expect(service.update(ORG_ID, USER_ID, 'wt1', { status: TransferStatus.CANCELLED })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('translates uniqueness handling (P2002) into ConflictException on update', async () => {
      const { service, update } = buildService();
      update.mockRejectedValue(p2002());

      await expect(service.update(ORG_ID, USER_ID, 'wt1', { notes: 'x' })).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('softDelete', () => {
    it('soft-deletes within the organization scope and audits', async () => {
      const { service, deleteFn, auditRecord } = buildService();

      const result = await service.softDelete(ORG_ID, USER_ID, 'wt1');

      expect(deleteFn).toHaveBeenCalledWith(ORG_ID, 'wt1');
      expect(result).toEqual({ message: 'Warehouse transfer deleted successfully' });
      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'WAREHOUSE_TRANSFER_DELETED', organizationId: ORG_ID }),
      );
    });

    it('translates P2025 into NotFoundException for missing/cross-org/already-deleted records', async () => {
      const { service, deleteFn } = buildService();
      deleteFn.mockRejectedValue(p2025());

      await expect(service.softDelete(OTHER_ORG, USER_ID, 'wt1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
