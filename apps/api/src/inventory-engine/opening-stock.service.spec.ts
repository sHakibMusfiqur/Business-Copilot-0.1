import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { OpeningStockService } from './opening-stock.service';
import type { OpeningStockRepository } from './interfaces/opening-stock-repository.interface';
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

const buildOpeningStock = (overrides: Record<string, unknown> = {}) => ({
  id: 'os1',
  organizationId: ORG_ID,
  warehouseId: 'w1',
  productId: 'p1',
  batchId: null,
  serialNumberId: null,
  quantity: 100,
  unitCost: new Prisma.Decimal(2),
  totalValue: new Prisma.Decimal(200),
  referenceDate: new Date('2026-01-01'),
  notes: null,
  metadata: {},
  createdAt: new Date('2026-01-01'),
  ...overrides,
});

const buildService = (overrides: Record<string, jest.Mock> = {}) => {
  const findById = overrides.findById ?? jest.fn();
  const findByOrganization = overrides.findByOrganization ?? jest.fn().mockResolvedValue([]);
  const create = overrides.create ?? jest.fn();
  const update = overrides.update ?? jest.fn();
  const verifyReferences = overrides.verifyReferences ?? jest.fn().mockResolvedValue(true);
  const auditRecord = overrides.auditRecord ?? jest.fn().mockResolvedValue(undefined);

  const service = new OpeningStockService(
    { findById, findByOrganization, create, update, verifyReferences } as unknown as OpeningStockRepository,
    { record: auditRecord } as unknown as AuditService,
  );

  return { service, findById, findByOrganization, create, update, verifyReferences, auditRecord };
};

describe('OpeningStockService', () => {
  afterEach(() => jest.clearAllMocks());

  it('is standalone: exposes no delete service method and never touches stockId', () => {
    const { service, create } = buildService();
    const svc = service as unknown as Record<string, unknown>;

    expect(typeof svc.softDelete).toBe('undefined');
    expect(typeof svc.delete).toBe('undefined');
    expect('stockId' in OpeningStockService.prototype).toBe(false);
    expect(create).toBeDefined();
  });

  describe('create', () => {
    it('creates a standalone opening stock scoped to the organization without stockId', async () => {
      const { service, create, auditRecord } = buildService();
      create.mockResolvedValue(buildOpeningStock());

      const result = await service.create(ORG_ID, USER_ID, {
        warehouseId: 'w1',
        productId: 'p1',
        quantity: 100,
        referenceDate: '2026-01-01',
      });

      const data = create.mock.calls[0][0];
      expect(data).toEqual(
        expect.objectContaining({
          organizationId: ORG_ID,
          warehouseId: 'w1',
          productId: 'p1',
          quantity: 100,
          referenceDate: new Date('2026-01-01'),
        }),
      );
      expect(data).not.toHaveProperty('stockId');
      expect(data).not.toHaveProperty('stock');
      expect(result.id).toBe('os1');
      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'OPENING_STOCK_CREATED', organizationId: ORG_ID }),
      );
    });

    it('keeps optional batch and serial nullable', async () => {
      const { service, create } = buildService();
      create.mockResolvedValue(buildOpeningStock({ batchId: 'b1', serialNumberId: 'sn1' }));

      await service.create(ORG_ID, USER_ID, {
        warehouseId: 'w1',
        productId: 'p1',
        quantity: 5,
        referenceDate: '2026-01-01',
        batchId: 'b1',
        serialNumberId: 'sn1',
      });

      const data = create.mock.calls[0][0];
      expect(data.batchId).toBe('b1');
      expect(data.serialNumberId).toBe('sn1');
      expect(data.unitCost).toEqual(new Prisma.Decimal(0));
    });

    it('translates unique-constraint failure (P2002) into ConflictException', async () => {
      const { service, create, auditRecord } = buildService();
      create.mockRejectedValue(p2002());

      await expect(
        service.create(ORG_ID, USER_ID, {
          warehouseId: 'w1',
          productId: 'p1',
          quantity: 1,
          referenceDate: '2026-01-01',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(auditRecord).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns an opening stock record within the organization scope', async () => {
      const { service, findById } = buildService();
      findById.mockResolvedValue(buildOpeningStock());

      const result = await service.findById(ORG_ID, 'os1');

      expect(findById).toHaveBeenCalledWith(ORG_ID, 'os1');
      expect(result.id).toBe('os1');
    });

    it('throws NotFoundException for cross-organization access', async () => {
      const { service, findById } = buildService();
      findById.mockResolvedValue(null);

      await expect(service.findById(OTHER_ORG, 'os1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('returns paginated results scoped to the organization with warehouse filter', async () => {
      const { service, findByOrganization } = buildService();
      findByOrganization.mockResolvedValue([
        buildOpeningStock(),
        buildOpeningStock({ id: 'os2', warehouseId: 'w2' }),
      ]);

      const all = await service.findAll(ORG_ID, {});
      expect(findByOrganization).toHaveBeenCalledWith(ORG_ID);
      expect(all.meta).toEqual({ total: 2, page: 1, limit: 10, totalPages: 1 });

      const byWarehouse = await service.findAll(ORG_ID, { warehouseId: 'w2' });
      expect(byWarehouse.data.map((row) => row.id)).toEqual(['os2']);
    });
  });

  describe('update', () => {
    it('updates quantity within the organization scope where the contract allows', async () => {
      const { service, update, auditRecord } = buildService();
      update.mockResolvedValue(buildOpeningStock({ quantity: 250 }));

      const result = await service.update(ORG_ID, USER_ID, 'os1', { quantity: 250 });

      expect(update).toHaveBeenCalledWith(ORG_ID, 'os1', { quantity: 250 });
      expect(result.quantity).toBe(250);
      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'OPENING_STOCK_UPDATED', organizationId: ORG_ID }),
      );
    });

    it('translates P2025 into NotFoundException', async () => {
      const { service, update } = buildService();
      update.mockRejectedValue(p2025());

      await expect(service.update(ORG_ID, USER_ID, 'os1', { quantity: 1 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
