import { ConflictException, NotFoundException } from '@nestjs/common';
import { AdjustmentType, Prisma } from '@prisma/client';

import { StockAdjustmentService } from './stock-adjustment.service';
import type { StockAdjustmentRepository } from './interfaces/stock-adjustment-repository.interface';
import type { AuditService } from '../audit/audit.service';

const ORG_ID = 'org-1';
const USER_ID = 'user-1';

const p2002 = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6.0.0',
    meta: {},
  });

const buildAdjustment = (overrides: Record<string, unknown> = {}) => ({
  id: 'adj1',
  organizationId: ORG_ID,
  stockId: 'st1',
  adjustmentType: AdjustmentType.ADD,
  quantityBefore: 10,
  quantityAfter: 15,
  adjustmentQty: 5,
  reason: 'Restock',
  notes: null,
  metadata: {},
  createdAt: new Date('2026-01-01'),
  ...overrides,
});

const buildService = (overrides: Record<string, jest.Mock> = {}) => {
  const findById = overrides.findById ?? jest.fn();
  const findByOrganization = overrides.findByOrganization ?? jest.fn().mockResolvedValue([]);
  const create = overrides.create ?? jest.fn();
  const auditRecord = overrides.auditRecord ?? jest.fn().mockResolvedValue(undefined);

  const service = new StockAdjustmentService(
    { findById, findByOrganization, create } as unknown as StockAdjustmentRepository,
    { record: auditRecord } as unknown as AuditService,
  );

  return { service, findById, findByOrganization, create, auditRecord };
};

describe('StockAdjustmentService', () => {
  afterEach(() => jest.clearAllMocks());

  it('is append-only: exposes no update or delete service methods', () => {
    const { service } = buildService();
    const svc = service as unknown as Record<string, unknown>;

    expect(typeof svc.update).toBe('undefined');
    expect(typeof svc.softDelete).toBe('undefined');
    expect(typeof svc.delete).toBe('undefined');
  });

  describe('create', () => {
    it('creates an adjustment scoped to the organization preserving adjustment fields exactly', async () => {
      const { service, create, auditRecord } = buildService();
      create.mockResolvedValue(buildAdjustment());

      const result = await service.create(ORG_ID, USER_ID, {
        stockId: 'st1',
        adjustmentType: AdjustmentType.ADD,
        quantityBefore: 10,
        quantityAfter: 15,
        adjustmentQty: 5,
        reason: 'Restock',
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ORG_ID,
          stockId: 'st1',
          adjustmentType: AdjustmentType.ADD,
          quantityBefore: 10,
          quantityAfter: 15,
          adjustmentQty: 5,
          reason: 'Restock',
        }),
      );
      expect(result.adjustmentQty).toBe(5);
      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'STOCK_ADJUSTMENT_CREATED', organizationId: ORG_ID }),
      );
    });

    it('preserves SUBTRACT adjustments with signed adjustmentQty', async () => {
      const { service, create } = buildService();
      create.mockResolvedValue(
        buildAdjustment({ adjustmentType: AdjustmentType.SUBTRACT, adjustmentQty: -3 }),
      );

      await service.create(ORG_ID, USER_ID, {
        stockId: 'st1',
        adjustmentType: AdjustmentType.SUBTRACT,
        quantityBefore: 10,
        quantityAfter: 7,
        adjustmentQty: -3,
      });

      const data = create.mock.calls[0][0];
      expect(data.adjustmentType).toBe(AdjustmentType.SUBTRACT);
      expect(data.adjustmentQty).toBe(-3);
      expect(data.quantityBefore).toBe(10);
      expect(data.quantityAfter).toBe(7);
    });

    it('translates unique-constraint failure (P2002) into ConflictException', async () => {
      const { service, create, auditRecord } = buildService();
      create.mockRejectedValue(p2002());

      await expect(
        service.create(ORG_ID, USER_ID, {
          stockId: 'st1',
          adjustmentType: AdjustmentType.SET,
          quantityBefore: 1,
          quantityAfter: 2,
          adjustmentQty: 2,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(auditRecord).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns an adjustment within the organization scope', async () => {
      const { service, findById } = buildService();
      findById.mockResolvedValue(buildAdjustment());

      const result = await service.findById(ORG_ID, 'adj1');

      expect(findById).toHaveBeenCalledWith(ORG_ID, 'adj1');
      expect(result.id).toBe('adj1');
    });

    it('throws NotFoundException for cross-organization access', async () => {
      const { service, findById } = buildService();
      findById.mockResolvedValue(null);

      await expect(service.findById('org-2', 'adj1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('returns paginated results scoped to the organization with adjustmentType filter', async () => {
      const { service, findByOrganization } = buildService();
      findByOrganization.mockResolvedValue([
        buildAdjustment(),
        buildAdjustment({ id: 'adj2', adjustmentType: AdjustmentType.SUBTRACT }),
      ]);

      const all = await service.findAll(ORG_ID, {});
      expect(findByOrganization).toHaveBeenCalledWith(ORG_ID);
      expect(all.meta).toEqual({ total: 2, page: 1, limit: 10, totalPages: 1 });

      const filtered = await service.findAll(ORG_ID, { adjustmentType: AdjustmentType.SUBTRACT });
      expect(filtered.data.map((row) => row.id)).toEqual(['adj2']);
    });
  });
});
