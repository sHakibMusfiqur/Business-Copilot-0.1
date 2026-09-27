import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, StockMovementType } from '@prisma/client';

import { StockMovementService } from './stock-movement.service';
import type { StockMovementRepository } from './interfaces/stock-movement-repository.interface';
import type { AuditService } from '../audit/audit.service';

const ORG_ID = 'org-1';
const USER_ID = 'user-1';

const p2002 = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6.0.0',
    meta: {},
  });

const buildMovement = (overrides: Record<string, unknown> = {}) => ({
  id: 'mv1',
  organizationId: ORG_ID,
  stockId: 'st1',
  movementType: StockMovementType.SALE,
  quantity: 5,
  unitCost: new Prisma.Decimal(2),
  totalCost: new Prisma.Decimal(10),
  referenceType: 'SALE',
  referenceId: 'sale-1',
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

  const service = new StockMovementService(
    { findById, findByOrganization, create } as unknown as StockMovementRepository,
    { record: auditRecord } as unknown as AuditService,
  );

  return { service, findById, findByOrganization, create, auditRecord };
};

describe('StockMovementService', () => {
  afterEach(() => jest.clearAllMocks());

  it('is append-only: exposes no update or delete service methods', () => {
    const { service } = buildService();
    const svc = service as unknown as Record<string, unknown>;

    expect(typeof svc.update).toBe('undefined');
    expect(typeof svc.softDelete).toBe('undefined');
    expect(typeof svc.delete).toBe('undefined');
  });

  describe('create', () => {
    it('creates a movement scoped to the organization preserving movementType and reference pair', async () => {
      const { service, create, auditRecord } = buildService();
      create.mockResolvedValue(buildMovement());

      const result = await service.create(ORG_ID, USER_ID, {
        stockId: 'st1',
        movementType: StockMovementType.SALE,
        quantity: 5,
        referenceType: 'SALE',
        referenceId: 'sale-1',
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ORG_ID,
          stockId: 'st1',
          movementType: StockMovementType.SALE,
          quantity: 5,
          referenceType: 'SALE',
          referenceId: 'sale-1',
        }),
      );
      expect(result.movementType).toBe(StockMovementType.SALE);
      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'STOCK_MOVEMENT_CREATED', organizationId: ORG_ID }),
      );
    });

    it('defaults optional reference fields to null', async () => {
      const { service, create } = buildService();
      create.mockResolvedValue(buildMovement({ referenceType: null, referenceId: null }));

      await service.create(ORG_ID, USER_ID, {
        stockId: 'st1',
        movementType: StockMovementType.PURCHASE,
        quantity: 10,
      });

      const data = create.mock.calls[0][0];
      expect(data.referenceType).toBeNull();
      expect(data.referenceId).toBeNull();
      expect(data.unitCost).toEqual(new Prisma.Decimal(0));
    });

    it('translates unique-constraint failure (P2002) into ConflictException', async () => {
      const { service, create, auditRecord } = buildService();
      create.mockRejectedValue(p2002());

      await expect(
        service.create(ORG_ID, USER_ID, {
          stockId: 'st1',
          movementType: StockMovementType.SALE,
          quantity: 1,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(auditRecord).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns a movement within the organization scope', async () => {
      const { service, findById } = buildService();
      findById.mockResolvedValue(buildMovement());

      const result = await service.findById(ORG_ID, 'mv1');

      expect(findById).toHaveBeenCalledWith(ORG_ID, 'mv1');
      expect(result.id).toBe('mv1');
    });

    it('throws NotFoundException for cross-organization access', async () => {
      const { service, findById } = buildService();
      findById.mockResolvedValue(null);

      await expect(service.findById('org-2', 'mv1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('returns paginated results scoped to the organization with movementType filter', async () => {
      const { service, findByOrganization } = buildService();
      findByOrganization.mockResolvedValue([
        buildMovement(),
        buildMovement({ id: 'mv2', movementType: StockMovementType.PURCHASE }),
      ]);

      const all = await service.findAll(ORG_ID, {});
      expect(findByOrganization).toHaveBeenCalledWith(ORG_ID);
      expect(all.meta).toEqual({ total: 2, page: 1, limit: 10, totalPages: 1 });

      const filtered = await service.findAll(ORG_ID, { movementType: StockMovementType.PURCHASE });
      expect(filtered.data.map((row) => row.id)).toEqual(['mv2']);
    });
  });
});
