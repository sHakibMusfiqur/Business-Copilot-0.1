import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, StockStatus } from '@prisma/client';

import { StockService } from './stock.service';
import type { StockRepository } from './interfaces/stock-repository.interface';
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

const buildStock = (overrides: Record<string, unknown> = {}) => ({
  id: 'st1',
  organizationId: ORG_ID,
  warehouseId: 'w1',
  productId: 'p1',
  batchId: null,
  serialNumberId: null,
  quantity: 10,
  reservedQuantity: 0,
  damagedQuantity: 0,
  returnedQuantity: 0,
  inTransitQuantity: 0,
  safetyStock: 0,
  reorderLevel: 0,
  unitCost: new Prisma.Decimal(5),
  totalValue: new Prisma.Decimal(50),
  status: StockStatus.ACTIVE,
  metadata: {},
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  ...overrides,
});

const buildService = (overrides: Record<string, jest.Mock> = {}) => {
  const findById = overrides.findById ?? jest.fn();
  const findByOrganization = overrides.findByOrganization ?? jest.fn().mockResolvedValue([]);
  const create = overrides.create ?? jest.fn();
  const update = overrides.update ?? jest.fn();
  const verifyReferences = overrides.verifyReferences ?? jest.fn().mockResolvedValue(true);
  const auditRecord = overrides.auditRecord ?? jest.fn().mockResolvedValue(undefined);

  const service = new StockService(
    { findById, findByOrganization, create, update, verifyReferences } as unknown as StockRepository,
    { record: auditRecord } as unknown as AuditService,
  );

  return { service, findById, findByOrganization, create, update, verifyReferences, auditRecord };
};

describe('StockService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('creates stock scoped to the organization with nullable batch/serial', async () => {
      const { service, create, auditRecord } = buildService();
      create.mockResolvedValue(buildStock());

      const result = await service.create(ORG_ID, USER_ID, {
        warehouseId: 'w1',
        productId: 'p1',
        quantity: 10,
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ORG_ID,
          warehouseId: 'w1',
          productId: 'p1',
          batchId: null,
          serialNumberId: null,
          quantity: 10,
          status: StockStatus.ACTIVE,
        }),
      );
      expect(result.id).toBe('st1');
      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'STOCK_CREATED', organizationId: ORG_ID }),
      );
    });

    it('passes optional batch and serial through when provided', async () => {
      const { service, create } = buildService();
      create.mockResolvedValue(buildStock({ batchId: 'b9', serialNumberId: 'sn9' }));

      await service.create(ORG_ID, USER_ID, {
        warehouseId: 'w1',
        productId: 'p1',
        batchId: 'b9',
        serialNumberId: 'sn9',
        unitCost: 5.5,
        totalValue: 55,
      });

      const data = create.mock.calls[0][0];
      expect(data.batchId).toBe('b9');
      expect(data.serialNumberId).toBe('sn9');
      expect(data.unitCost).toEqual(new Prisma.Decimal(5.5));
      expect(data.totalValue).toEqual(new Prisma.Decimal(55));
    });

    it('translates composite-key conflict (P2002) into ConflictException', async () => {
      const { service, create, auditRecord } = buildService();
      create.mockRejectedValue(p2002());

      await expect(
        service.create(ORG_ID, USER_ID, { warehouseId: 'w1', productId: 'p1' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(auditRecord).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns stock within the organization scope', async () => {
      const { service, findById } = buildService();
      findById.mockResolvedValue(buildStock());

      const result = await service.findById(ORG_ID, 'st1');

      expect(findById).toHaveBeenCalledWith(ORG_ID, 'st1');
      expect(result.id).toBe('st1');
    });

    it('throws NotFoundException for cross-organization access', async () => {
      const { service, findById } = buildService();
      findById.mockResolvedValue(null);

      await expect(service.findById(OTHER_ORG, 'st1')).rejects.toBeInstanceOf(NotFoundException);
      expect(findById).toHaveBeenCalledWith(OTHER_ORG, 'st1');
    });
  });

  describe('findAll', () => {
    it('returns paginated results scoped to the organization', async () => {
      const { service, findByOrganization } = buildService();
      findByOrganization.mockResolvedValue([
        buildStock(),
        buildStock({ id: 'st2', status: StockStatus.DAMAGED }),
      ]);

      const result = await service.findAll(ORG_ID, {});

      expect(findByOrganization).toHaveBeenCalledWith(ORG_ID);
      expect(result.meta).toEqual({ total: 2, page: 1, limit: 10, totalPages: 1 });
    });

    it('applies status filter', async () => {
      const { service, findByOrganization } = buildService();
      findByOrganization.mockResolvedValue([
        buildStock(),
        buildStock({ id: 'st2', status: StockStatus.DAMAGED }),
      ]);

      const result = await service.findAll(ORG_ID, { status: StockStatus.DAMAGED });

      expect(result.data.map((row) => row.id)).toEqual(['st2']);
    });
  });

  describe('update', () => {
    it('updates counters and status within the organization scope', async () => {
      const { service, update, auditRecord } = buildService();
      update.mockResolvedValue(buildStock({ quantity: 42 }));

      const result = await service.update(ORG_ID, USER_ID, 'st1', { quantity: 42 });

      expect(update).toHaveBeenCalledWith(ORG_ID, 'st1', { quantity: 42 });
      expect(result.quantity).toBe(42);
      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'STOCK_UPDATED', organizationId: ORG_ID }),
      );
    });

    it('translates P2025 into NotFoundException', async () => {
      const { service, update } = buildService();
      update.mockRejectedValue(p2025());

      await expect(service.update(ORG_ID, USER_ID, 'st1', { quantity: 1 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('translates composite-key conflict (P2002) into ConflictException on update', async () => {
      const { service, update } = buildService();
      update.mockRejectedValue(p2002());

      await expect(service.update(ORG_ID, USER_ID, 'st1', { batchId: 'b9' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });
});
