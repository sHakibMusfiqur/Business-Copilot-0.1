import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, SerialStatus } from '@prisma/client';

import { SerialNumberService } from './serial-number.service';
import type { SerialNumberRepository } from './interfaces/serial-number-repository.interface';
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

const buildSerial = (overrides: Record<string, unknown> = {}) => ({
  id: 'sn1',
  organizationId: ORG_ID,
  productId: 'p1',
  batchId: null,
  serialNumber: 'SN-001',
  status: SerialStatus.AVAILABLE,
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

  const service = new SerialNumberService(
    { findById, findByOrganization, create, update, delete: deleteFn } as unknown as SerialNumberRepository,
    { record: auditRecord } as unknown as AuditService,
  );

  return { service, findById, findByOrganization, create, update, deleteFn, auditRecord };
};

describe('SerialNumberService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('creates a serial number with optional batch scoped to the organization', async () => {
      const { service, create, auditRecord } = buildService();
      create.mockResolvedValue(buildSerial({ batchId: 'batch-9' }));

      const result = await service.create(ORG_ID, USER_ID, {
        productId: 'p1',
        serialNumber: ' SN-001 ',
        batchId: 'batch-9',
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ORG_ID,
          productId: 'p1',
          serialNumber: 'SN-001',
          batchId: 'batch-9',
          status: SerialStatus.AVAILABLE,
          deletedAt: null,
        }),
      );
      expect(result.batchId).toBe('batch-9');
      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SERIAL_NUMBER_CREATED', organizationId: ORG_ID }),
      );
    });

    it('defaults batchId to null when omitted', async () => {
      const { service, create } = buildService();
      create.mockResolvedValue(buildSerial());

      await service.create(ORG_ID, USER_ID, { productId: 'p1', serialNumber: 'SN-001' });

      expect(create.mock.calls[0][0].batchId).toBeNull();
    });

    it('translates unique-constraint failure (P2002) into ConflictException', async () => {
      const { service, create, auditRecord } = buildService();
      create.mockRejectedValue(p2002());

      await expect(
        service.create(ORG_ID, USER_ID, { productId: 'p1', serialNumber: 'SN-001' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(auditRecord).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns a serial number within the organization scope', async () => {
      const { service, findById } = buildService();
      findById.mockResolvedValue(buildSerial());

      const result = await service.findById(ORG_ID, 'sn1');

      expect(findById).toHaveBeenCalledWith(ORG_ID, 'sn1');
      expect(result.serialNumber).toBe('SN-001');
    });

    it('throws NotFoundException for cross-organization access', async () => {
      const { service, findById } = buildService();
      findById.mockResolvedValue(null);

      await expect(service.findById(OTHER_ORG, 'sn1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('returns paginated results scoped to the organization with search and status filters', async () => {
      const { service, findByOrganization } = buildService();
      findByOrganization.mockResolvedValue([
        buildSerial(),
        buildSerial({ id: 'sn2', serialNumber: 'OTHER-2' }),
        buildSerial({ id: 'sn3', serialNumber: 'SN-003', status: SerialStatus.SOLD }),
      ]);

      const all = await service.findAll(ORG_ID, {});
      expect(findByOrganization).toHaveBeenCalledWith(ORG_ID);
      expect(all.meta).toEqual({ total: 3, page: 1, limit: 10, totalPages: 1 });

      const searched = await service.findAll(ORG_ID, { search: 'sn-' });
      expect(searched.data.map((row) => row.id)).toEqual(['sn1', 'sn3']);

      const byStatus = await service.findAll(ORG_ID, { status: SerialStatus.SOLD });
      expect(byStatus.data.map((row) => row.id)).toEqual(['sn3']);
    });
  });

  describe('update', () => {
    it('updates allowed fields within the organization scope', async () => {
      const { service, update, auditRecord } = buildService();
      update.mockResolvedValue(buildSerial({ status: SerialStatus.RESERVED }));

      const result = await service.update(ORG_ID, USER_ID, 'sn1', { status: SerialStatus.RESERVED });

      expect(update).toHaveBeenCalledWith(ORG_ID, 'sn1', { status: SerialStatus.RESERVED });
      expect(result.status).toBe(SerialStatus.RESERVED);
      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SERIAL_NUMBER_UPDATED', organizationId: ORG_ID }),
      );
    });

    it('translates P2025 into NotFoundException', async () => {
      const { service, update } = buildService();
      update.mockRejectedValue(p2025());

      await expect(service.update(ORG_ID, USER_ID, 'sn1', { status: SerialStatus.SOLD })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('translates unique-constraint failure (P2002) into ConflictException', async () => {
      const { service, update } = buildService();
      update.mockRejectedValue(p2002());

      await expect(service.update(ORG_ID, USER_ID, 'sn1', { serialNumber: 'SN-001' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('softDelete', () => {
    it('soft-deletes within the organization scope and audits', async () => {
      const { service, deleteFn, auditRecord } = buildService();

      const result = await service.softDelete(ORG_ID, USER_ID, 'sn1');

      expect(deleteFn).toHaveBeenCalledWith(ORG_ID, 'sn1');
      expect(result).toEqual({ message: 'Serial number deleted successfully' });
      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SERIAL_NUMBER_DELETED', organizationId: ORG_ID }),
      );
    });

    it('translates P2025 into NotFoundException for missing/cross-org records', async () => {
      const { service, deleteFn } = buildService();
      deleteFn.mockRejectedValue(p2025());

      await expect(service.softDelete(OTHER_ORG, USER_ID, 'sn1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
