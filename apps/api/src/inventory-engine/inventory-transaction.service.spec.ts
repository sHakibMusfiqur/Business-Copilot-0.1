import { ConflictException, NotFoundException } from '@nestjs/common';
import { InventoryTransactionType, Prisma, TransactionType } from '@prisma/client';

import { InventoryTransactionService } from './inventory-transaction.service';
import type { InventoryTransactionRepository } from './interfaces/inventory-transaction-repository.interface';
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

const buildTransaction = (overrides: Record<string, unknown> = {}) => ({
  id: 'it1',
  organizationId: ORG_ID,
  productId: 'p1',
  type: TransactionType.IN,
  quantity: 10,
  previousQuantity: 0,
  newQuantity: 10,
  reference: 'PO-1',
  notes: null,
  createdById: USER_ID,
  createdAt: new Date('2026-01-01'),
  transactionType: InventoryTransactionType.PURCHASE,
  referenceType: null,
  referenceId: null,
  totalQuantity: null,
  totalValue: null,
  status: null,
  metadata: null,
  ...overrides,
});

const buildService = (overrides: Record<string, jest.Mock> = {}) => {
  const findById = overrides.findById ?? jest.fn();
  const findByOrganization = overrides.findByOrganization ?? jest.fn().mockResolvedValue([]);
  const create = overrides.create ?? jest.fn();
  const verifyReferences = overrides.verifyReferences ?? jest.fn().mockResolvedValue(true);
  const auditRecord = overrides.auditRecord ?? jest.fn().mockResolvedValue(undefined);

  const service = new InventoryTransactionService(
    { findById, findByOrganization, create, verifyReferences } as unknown as InventoryTransactionRepository,
    { record: auditRecord } as unknown as AuditService,
  );

  return { service, findById, findByOrganization, create, verifyReferences, auditRecord };
};

describe('InventoryTransactionService', () => {
  afterEach(() => jest.clearAllMocks());

  it('is append-only: exposes no update or delete service methods', () => {
    const { service } = buildService();
    const svc = service as unknown as Record<string, unknown>;

    expect(typeof svc.update).toBe('undefined');
    expect(typeof svc.softDelete).toBe('undefined');
    expect(typeof svc.delete).toBe('undefined');
  });

  describe('create', () => {
    it('creates a transaction scoped to the organization with server-derived createdById', async () => {
      const { service, create, auditRecord } = buildService();
      create.mockResolvedValue(buildTransaction());

      const result = await service.create(ORG_ID, USER_ID, {
        productId: 'p1',
        type: TransactionType.IN,
        quantity: 10,
        previousQuantity: 0,
        newQuantity: 10,
        reference: 'PO-1',
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ORG_ID,
          productId: 'p1',
          type: TransactionType.IN,
          quantity: 10,
          createdById: USER_ID,
        }),
      );
      expect(result.id).toBe('it1');
      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INVENTORY_TRANSACTION_CREATED', organizationId: ORG_ID }),
      );
    });

    it('keeps legacy type and engine transactionType separate without mapping', async () => {
      const { service, create } = buildService();
      create.mockResolvedValue(buildTransaction());

      await service.create(ORG_ID, USER_ID, {
        productId: 'p1',
        type: TransactionType.OUT,
        quantity: 3,
        transactionType: InventoryTransactionType.SALE,
      });

      const data = create.mock.calls[0][0];
      expect(data.type).toBe(TransactionType.OUT);
      expect(data.transactionType).toBe(InventoryTransactionType.SALE);
      expect(data.type).not.toBe(data.transactionType);
    });

    it('keeps nullable engine fields null when omitted', async () => {
      const { service, create } = buildService();
      create.mockResolvedValue(buildTransaction());

      await service.create(ORG_ID, USER_ID, {
        productId: 'p1',
        type: TransactionType.ADJUSTMENT,
        quantity: 1,
      });

      const data = create.mock.calls[0][0];
      expect(data.transactionType).toBeNull();
      expect(data.referenceType).toBeNull();
      expect(data.referenceId).toBeNull();
      expect(data.totalQuantity).toBeNull();
      expect(data.totalValue).toBeNull();
      expect(data.status).toBeNull();
      expect(data.metadata).toBeNull();
    });

    it('translates unique-constraint failure (P2002) into ConflictException', async () => {
      const { service, create, auditRecord } = buildService();
      create.mockRejectedValue(p2002());

      await expect(
        service.create(ORG_ID, USER_ID, {
          productId: 'p1',
          type: TransactionType.IN,
          quantity: 1,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(auditRecord).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns a transaction within the organization scope', async () => {
      const { service, findById } = buildService();
      findById.mockResolvedValue(buildTransaction());

      const result = await service.findById(ORG_ID, 'it1');

      expect(findById).toHaveBeenCalledWith(ORG_ID, 'it1');
      expect(result.type).toBe(TransactionType.IN);
      expect(result.transactionType).toBe(InventoryTransactionType.PURCHASE);
    });

    it('throws NotFoundException for cross-organization access', async () => {
      const { service, findById } = buildService();
      findById.mockResolvedValue(null);

      await expect(service.findById(OTHER_ORG, 'it1')).rejects.toBeInstanceOf(NotFoundException);
      expect(findById).toHaveBeenCalledWith(OTHER_ORG, 'it1');
    });
  });

  describe('findAll', () => {
    it('returns paginated results scoped to the organization with independent type filters', async () => {
      const { service, findByOrganization } = buildService();
      findByOrganization.mockResolvedValue([
        buildTransaction(),
        buildTransaction({ id: 'it2', type: TransactionType.OUT, transactionType: InventoryTransactionType.SALE }),
        buildTransaction({ id: 'it3', type: TransactionType.ADJUSTMENT, transactionType: null }),
      ]);

      const all = await service.findAll(ORG_ID, {});
      expect(findByOrganization).toHaveBeenCalledWith(ORG_ID);
      expect(all.meta).toEqual({ total: 3, page: 1, limit: 10, totalPages: 1 });

      const byLegacyType = await service.findAll(ORG_ID, { type: TransactionType.OUT });
      expect(byLegacyType.data.map((row) => row.id)).toEqual(['it2']);

      const byEngineType = await service.findAll(ORG_ID, { transactionType: InventoryTransactionType.PURCHASE });
      expect(byEngineType.data.map((row) => row.id)).toEqual(['it1']);
    });
  });
});
