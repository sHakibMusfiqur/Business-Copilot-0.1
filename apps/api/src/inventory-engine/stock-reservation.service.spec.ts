import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, ReservationStatus } from '@prisma/client';

import { StockReservationService } from './stock-reservation.service';
import type { StockReservationRepository } from './interfaces/stock-reservation-repository.interface';
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

const buildReservation = (overrides: Record<string, unknown> = {}) => ({
  id: 'r1',
  organizationId: ORG_ID,
  stockId: 'st1',
  quantity: 5,
  reservedQuantity: 5,
  status: ReservationStatus.PENDING,
  referenceType: 'SALE',
  referenceId: 'sale-1',
  notes: null,
  expiresAt: null,
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

  const service = new StockReservationService(
    { findById, findByOrganization, create, update, verifyReferences } as unknown as StockReservationRepository,
    { record: auditRecord } as unknown as AuditService,
  );

  return { service, findById, findByOrganization, create, update, verifyReferences, auditRecord };
};

describe('StockReservationService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('creates a reservation scoped to the organization with status and expiresAt', async () => {
      const { service, create, auditRecord } = buildService();
      create.mockResolvedValue(
        buildReservation({ status: ReservationStatus.CONFIRMED, expiresAt: new Date('2026-02-01') }),
      );

      const result = await service.create(ORG_ID, USER_ID, {
        stockId: 'st1',
        quantity: 5,
        status: ReservationStatus.CONFIRMED,
        expiresAt: '2026-02-01',
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ORG_ID,
          stockId: 'st1',
          quantity: 5,
          status: ReservationStatus.CONFIRMED,
          expiresAt: new Date('2026-02-01'),
        }),
      );
      expect(result.status).toBe(ReservationStatus.CONFIRMED);
      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'STOCK_RESERVATION_CREATED', organizationId: ORG_ID }),
      );
    });

    it('defaults status to PENDING and expiresAt to null', async () => {
      const { service, create } = buildService();
      create.mockResolvedValue(buildReservation());

      await service.create(ORG_ID, USER_ID, { stockId: 'st1', quantity: 3 });

      const data = create.mock.calls[0][0];
      expect(data.status).toBe(ReservationStatus.PENDING);
      expect(data.expiresAt).toBeNull();
      expect(data.reservedQuantity).toBe(0);
    });

    it('persists an explicitly provided null expiresAt as null', async () => {
      const { service, create } = buildService();
      create.mockResolvedValue(buildReservation());

      await service.create(ORG_ID, USER_ID, { stockId: 'st1', quantity: 3, expiresAt: null });

      expect(create.mock.calls[0][0].expiresAt).toBeNull();
    });

    it('translates unique-constraint failure (P2002) into ConflictException', async () => {
      const { service, create, auditRecord } = buildService();
      create.mockRejectedValue(p2002());

      await expect(service.create(ORG_ID, USER_ID, { stockId: 'st1', quantity: 1 })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(auditRecord).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns a reservation within the organization scope', async () => {
      const { service, findById } = buildService();
      findById.mockResolvedValue(buildReservation());

      const result = await service.findById(ORG_ID, 'r1');

      expect(findById).toHaveBeenCalledWith(ORG_ID, 'r1');
      expect(result.id).toBe('r1');
    });

    it('throws NotFoundException for cross-organization access', async () => {
      const { service, findById } = buildService();
      findById.mockResolvedValue(null);

      await expect(service.findById(OTHER_ORG, 'r1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('returns paginated results scoped to the organization with status filter', async () => {
      const { service, findByOrganization } = buildService();
      findByOrganization.mockResolvedValue([
        buildReservation(),
        buildReservation({ id: 'r2', status: ReservationStatus.FULFILLED }),
      ]);

      const all = await service.findAll(ORG_ID, {});
      expect(findByOrganization).toHaveBeenCalledWith(ORG_ID);
      expect(all.meta).toEqual({ total: 2, page: 1, limit: 10, totalPages: 1 });

      const byStatus = await service.findAll(ORG_ID, { status: ReservationStatus.FULFILLED });
      expect(byStatus.data.map((row) => row.id)).toEqual(['r2']);
    });
  });

  describe('update', () => {
    it('updates status and expiresAt within the organization scope', async () => {
      const { service, update, auditRecord } = buildService();
      update.mockResolvedValue(buildReservation({ status: ReservationStatus.RELEASED }));

      const result = await service.update(ORG_ID, USER_ID, 'r1', {
        status: ReservationStatus.RELEASED,
        expiresAt: undefined,
      });

      expect(update).toHaveBeenCalledWith(ORG_ID, 'r1', { status: ReservationStatus.RELEASED });
      expect(result.status).toBe(ReservationStatus.RELEASED);
      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'STOCK_RESERVATION_UPDATED', organizationId: ORG_ID }),
      );
    });

    it('clears expiresAt when explicitly set to null', async () => {
      const { service, update } = buildService();
      update.mockResolvedValue(buildReservation({ expiresAt: null }));

      await service.update(ORG_ID, USER_ID, 'r1', { expiresAt: null });

      expect(update).toHaveBeenCalledWith(ORG_ID, 'r1', { expiresAt: null });
    });

    it('translates P2025 into NotFoundException', async () => {
      const { service, update } = buildService();
      update.mockRejectedValue(p2025());

      await expect(service.update(ORG_ID, USER_ID, 'r1', { status: ReservationStatus.CANCELLED })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
