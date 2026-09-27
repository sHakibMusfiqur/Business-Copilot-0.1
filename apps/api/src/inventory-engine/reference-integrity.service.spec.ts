import { BadRequestException } from '@nestjs/common';
import { AdjustmentType, InventoryTransactionType, StockMovementType, TransactionType } from '@prisma/client';

import { BatchService } from './batch.service';
import { InventoryTransactionService } from './inventory-transaction.service';
import { OpeningStockService } from './opening-stock.service';
import { SerialNumberService } from './serial-number.service';
import { StockAdjustmentService } from './stock-adjustment.service';
import { StockMovementService } from './stock-movement.service';
import { StockReservationService } from './stock-reservation.service';
import { StockService } from './stock.service';
import { WarehouseTransferService } from './warehouse-transfer.service';
import type { BatchRepository } from './interfaces/batch-repository.interface';
import type { InventoryTransactionRepository } from './interfaces/inventory-transaction-repository.interface';
import type { OpeningStockRepository } from './interfaces/opening-stock-repository.interface';
import type { SerialNumberRepository } from './interfaces/serial-number-repository.interface';
import type { StockAdjustmentRepository } from './interfaces/stock-adjustment-repository.interface';
import type { StockMovementRepository } from './interfaces/stock-movement-repository.interface';
import type { StockReservationRepository } from './interfaces/stock-reservation-repository.interface';
import type { StockRepository } from './interfaces/stock-repository.interface';
import type { WarehouseTransferRepository } from './interfaces/warehouse-transfer-repository.interface';
import type { AuditService } from '../audit/audit.service';

const ORG_ID = 'org-1';
const OTHER_ORG = 'org-2';
const USER_ID = 'user-1';
const SAFE_ERROR = 'Related record not found';

type MockRepo = {
  verifyReferences: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  findById: jest.Mock;
  findByOrganization: jest.Mock;
};

const buildRepo = (overrides: Partial<Record<keyof MockRepo, jest.Mock>> = {}) => {
  const repo: MockRepo = {
    verifyReferences: overrides.verifyReferences ?? jest.fn().mockResolvedValue(true),
    create: overrides.create ?? jest.fn().mockResolvedValue({ id: 'r1' }),
    update: overrides.update ?? jest.fn().mockResolvedValue({ id: 'r1' }),
    delete: overrides.delete ?? jest.fn().mockResolvedValue(undefined),
    findById: overrides.findById ?? jest.fn(),
    findByOrganization: overrides.findByOrganization ?? jest.fn().mockResolvedValue([]),
  };
  return repo;
};

const buildAudit = () => ({ record: jest.fn().mockResolvedValue(undefined) });

const expectSafeRejection = async (promise: Promise<unknown>) => {
  const error = await promise.then(
    () => {
      throw new Error('expected the call to be rejected');
    },
    (err: unknown) => err,
  );
  expect(error).toBeInstanceOf(BadRequestException);
  const message = (error as Error).message;
  expect(message).toBe(SAFE_ERROR);
  expect(message).not.toContain(ORG_ID);
  expect(message).not.toContain(OTHER_ORG);
  expect(message).not.toMatch(/foreign|prod-|batch-|wh-|st-|sn-/i);
  return error as BadRequestException;
};

describe('cross-organization reference integrity (service layer)', () => {
  afterEach(() => jest.clearAllMocks());

  describe('Batch', () => {
    const build = (overrides?: Partial<Record<keyof MockRepo, jest.Mock>>) => {
      const repo = buildRepo(overrides);
      const audit = buildAudit();
      const service = new BatchService(repo as unknown as BatchRepository, audit as unknown as AuditService);
      return { service, repo, audit };
    };

    it('same-org product reference succeeds and is verified with the caller organization', async () => {
      const { service, repo, audit } = build();
      await service.create(ORG_ID, USER_ID, { productId: 'p1', batchNumber: 'B-001' });

      expect(repo.verifyReferences).toHaveBeenCalledWith(ORG_ID, { productId: 'p1' });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID, productId: 'p1' }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'BATCH_CREATED', organizationId: ORG_ID }),
      );
    });

    it('cross-org product reference is rejected with the safe, non-disclosing error', async () => {
      const { service, repo, audit } = build({ verifyReferences: jest.fn().mockResolvedValue(false) });

      await expectSafeRejection(
        service.create(ORG_ID, USER_ID, { productId: 'foreign-product', batchNumber: 'B-001' }),
      );

      expect(repo.create).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('never trusts a client-supplied organizationId in the payload', async () => {
      const { service, repo } = build();
      await service.create(ORG_ID, USER_ID, {
        productId: 'p1',
        batchNumber: 'B-001',
        organizationId: OTHER_ORG,
      } as unknown as { productId: string; batchNumber: string });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID }),
      );
    });
  });

  describe('SerialNumber', () => {
    const build = (overrides?: Partial<Record<keyof MockRepo, jest.Mock>>) => {
      const repo = buildRepo(overrides);
      const audit = buildAudit();
      const service = new SerialNumberService(
        repo as unknown as SerialNumberRepository,
        audit as unknown as AuditService,
      );
      return { service, repo, audit };
    };

    it('same-org product and batch references succeed', async () => {
      const { service, repo } = build();
      await service.create(ORG_ID, USER_ID, {
        productId: 'p1',
        batchId: 'b1',
        serialNumber: 'SN-1',
      });

      expect(repo.verifyReferences).toHaveBeenCalledWith(ORG_ID, {
        productId: 'p1',
        batchId: 'b1',
      });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID, productId: 'p1', batchId: 'b1' }),
      );
    });

    it('cross-org product reference is rejected safely', async () => {
      const { service, repo, audit } = build({ verifyReferences: jest.fn().mockResolvedValue(false) });

      await expectSafeRejection(
        service.create(ORG_ID, USER_ID, { productId: 'foreign-product', serialNumber: 'SN-1' }),
      );
      expect(repo.create).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('cross-org batch reference is rejected safely', async () => {
      const { service, repo } = build({ verifyReferences: jest.fn().mockResolvedValue(false) });

      await expectSafeRejection(
        service.create(ORG_ID, USER_ID, {
          productId: 'p1',
          batchId: 'foreign-batch',
          serialNumber: 'SN-1',
        }),
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('update validates a changed batch reference', async () => {
      const { service, repo } = build();
      await service.update(ORG_ID, USER_ID, 'sn1', { batchId: 'b1' });

      expect(repo.verifyReferences).toHaveBeenCalledWith(ORG_ID, { batchId: 'b1' });
      expect(repo.update).toHaveBeenCalledWith(ORG_ID, 'sn1', { batchId: 'b1' });
    });

    it('update rejects a cross-org changed batch reference', async () => {
      const { service, repo } = build({ verifyReferences: jest.fn().mockResolvedValue(false) });

      await expectSafeRejection(service.update(ORG_ID, USER_ID, 'sn1', { batchId: 'foreign-batch' }));
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('update clears a nullable batch reference with explicit null without re-validating it', async () => {
      const { service, repo } = build();
      await service.update(ORG_ID, USER_ID, 'sn1', { batchId: null });

      expect(repo.verifyReferences).not.toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalledWith(ORG_ID, 'sn1', { batchId: null });
    });

    it('update skips reference verification when nothing reference-related changed', async () => {
      const { service, repo } = build();
      await service.update(ORG_ID, USER_ID, 'sn1', { serialNumber: 'SN-2' });

      expect(repo.verifyReferences).not.toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalledWith(ORG_ID, 'sn1', { serialNumber: 'SN-2' });
    });
  });

  describe('Stock', () => {
    const build = (overrides?: Partial<Record<keyof MockRepo, jest.Mock>>) => {
      const repo = buildRepo(overrides);
      const audit = buildAudit();
      const service = new StockService(repo as unknown as StockRepository, audit as unknown as AuditService);
      return { service, repo, audit };
    };

    it('same-org warehouse, product, batch and serial references succeed together', async () => {
      const { service, repo } = build();
      await service.create(ORG_ID, USER_ID, {
        warehouseId: 'w1',
        productId: 'p1',
        batchId: 'b1',
        serialNumberId: 'sn1',
        quantity: 5,
      });

      expect(repo.verifyReferences).toHaveBeenCalledWith(ORG_ID, {
        warehouseId: 'w1',
        productId: 'p1',
        batchId: 'b1',
        serialNumberId: 'sn1',
      });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID, warehouseId: 'w1', productId: 'p1' }),
      );
    });

    it.each([
      ['warehouse', { warehouseId: 'foreign-wh', productId: 'p1' }],
      ['product', { warehouseId: 'w1', productId: 'foreign-product' }],
      ['batch', { warehouseId: 'w1', productId: 'p1', batchId: 'foreign-batch' }],
      ['serial', { warehouseId: 'w1', productId: 'p1', serialNumberId: 'foreign-serial' }],
    ])('cross-org %s reference is rejected safely', async (_name, refs) => {
      const { service, repo, audit } = build({ verifyReferences: jest.fn().mockResolvedValue(false) });

      await expectSafeRejection(service.create(ORG_ID, USER_ID, { quantity: 1, ...refs } as never));
      expect(repo.create).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('update validates changed batch and serial references only', async () => {
      const { service, repo } = build();
      await service.update(ORG_ID, USER_ID, 'st1', { batchId: 'b1', serialNumberId: 'sn1' });

      expect(repo.verifyReferences).toHaveBeenCalledWith(ORG_ID, {
        batchId: 'b1',
        serialNumberId: 'sn1',
      });
      expect(repo.update).toHaveBeenCalledWith(ORG_ID, 'st1', {
        batchId: 'b1',
        serialNumberId: 'sn1',
      });
    });

    it('update rejects a cross-org changed reference', async () => {
      const { service, repo } = build({ verifyReferences: jest.fn().mockResolvedValue(false) });

      await expectSafeRejection(
        service.update(ORG_ID, USER_ID, 'st1', { serialNumberId: 'foreign-serial' }),
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('update clears nullable relations with explicit null without re-validating them', async () => {
      const { service, repo } = build();
      await service.update(ORG_ID, USER_ID, 'st1', { batchId: null, serialNumberId: null });

      expect(repo.verifyReferences).not.toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalledWith(ORG_ID, 'st1', {
        batchId: null,
        serialNumberId: null,
      });
    });

    it('update skips reference verification when only counters change', async () => {
      const { service, repo } = build();
      await service.update(ORG_ID, USER_ID, 'st1', { quantity: 42 });

      expect(repo.verifyReferences).not.toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalledWith(ORG_ID, 'st1', { quantity: 42 });
    });
  });

  describe('StockReservation', () => {
    const build = (overrides?: Partial<Record<keyof MockRepo, jest.Mock>>) => {
      const repo = buildRepo(overrides);
      const audit = buildAudit();
      const service = new StockReservationService(
        repo as unknown as StockReservationRepository,
        audit as unknown as AuditService,
      );
      return { service, repo, audit };
    };

    it('same-org stock reference succeeds', async () => {
      const { service, repo } = build();
      await service.create(ORG_ID, USER_ID, { stockId: 'st1', quantity: 5 });

      expect(repo.verifyReferences).toHaveBeenCalledWith(ORG_ID, { stockId: 'st1' });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID, stockId: 'st1' }),
      );
    });

    it('cross-org stock reference is rejected safely', async () => {
      const { service, repo, audit } = build({ verifyReferences: jest.fn().mockResolvedValue(false) });

      await expectSafeRejection(service.create(ORG_ID, USER_ID, { stockId: 'foreign-stock', quantity: 5 }));
      expect(repo.create).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe('StockAdjustment', () => {
    const build = (overrides?: Partial<Record<keyof MockRepo, jest.Mock>>) => {
      const repo = buildRepo(overrides);
      const audit = buildAudit();
      const service = new StockAdjustmentService(
        repo as unknown as StockAdjustmentRepository,
        audit as unknown as AuditService,
      );
      return { service, repo, audit };
    };

    it('same-org stock reference succeeds', async () => {
      const { service, repo } = build();
      await service.create(ORG_ID, USER_ID, {
        stockId: 'st1',
        adjustmentType: AdjustmentType.ADD,
        quantityBefore: 10,
        quantityAfter: 15,
        adjustmentQty: 5,
      });

      expect(repo.verifyReferences).toHaveBeenCalledWith(ORG_ID, { stockId: 'st1' });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID, stockId: 'st1' }),
      );
    });

    it('cross-org stock reference is rejected safely', async () => {
      const { service, repo, audit } = build({ verifyReferences: jest.fn().mockResolvedValue(false) });

      await expectSafeRejection(
        service.create(ORG_ID, USER_ID, {
          stockId: 'foreign-stock',
          adjustmentType: AdjustmentType.ADD,
          quantityBefore: 10,
          quantityAfter: 15,
          adjustmentQty: 5,
        }),
      );
      expect(repo.create).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe('StockMovement', () => {
    const build = (overrides?: Partial<Record<keyof MockRepo, jest.Mock>>) => {
      const repo = buildRepo(overrides);
      const audit = buildAudit();
      const service = new StockMovementService(
        repo as unknown as StockMovementRepository,
        audit as unknown as AuditService,
      );
      return { service, repo, audit };
    };

    it('same-org stock reference succeeds', async () => {
      const { service, repo } = build();
      await service.create(ORG_ID, USER_ID, {
        stockId: 'st1',
        movementType: StockMovementType.OPENING,
        quantity: 5,
      });

      expect(repo.verifyReferences).toHaveBeenCalledWith(ORG_ID, { stockId: 'st1' });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID, stockId: 'st1' }),
      );
    });

    it('cross-org stock reference is rejected safely', async () => {
      const { service, repo, audit } = build({ verifyReferences: jest.fn().mockResolvedValue(false) });

      await expectSafeRejection(
        service.create(ORG_ID, USER_ID, {
          stockId: 'foreign-stock',
          movementType: StockMovementType.OPENING,
          quantity: 5,
        }),
      );
      expect(repo.create).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe('WarehouseTransfer', () => {
    const build = (overrides?: Partial<Record<keyof MockRepo, jest.Mock>>) => {
      const repo = buildRepo(overrides);
      const audit = buildAudit();
      const service = new WarehouseTransferService(
        repo as unknown as WarehouseTransferRepository,
        audit as unknown as AuditService,
      );
      return { service, repo, audit };
    };

    it('same-org source and destination warehouses succeed together', async () => {
      const { service, repo } = build();
      await service.create(ORG_ID, USER_ID, {
        sourceWarehouseId: 'w1',
        destWarehouseId: 'w2',
        transferNumber: 'TR-1',
      });

      expect(repo.verifyReferences).toHaveBeenCalledWith(ORG_ID, {
        sourceWarehouseId: 'w1',
        destWarehouseId: 'w2',
      });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ORG_ID,
          sourceWarehouseId: 'w1',
          destWarehouseId: 'w2',
        }),
      );
    });

    it('cross-org source warehouse is rejected safely', async () => {
      const { service, repo, audit } = build({ verifyReferences: jest.fn().mockResolvedValue(false) });

      await expectSafeRejection(
        service.create(ORG_ID, USER_ID, {
          sourceWarehouseId: 'foreign-wh',
          destWarehouseId: 'w2',
          transferNumber: 'TR-1',
        }),
      );
      expect(repo.create).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('cross-org destination warehouse is rejected safely', async () => {
      const { service, repo } = build({ verifyReferences: jest.fn().mockResolvedValue(false) });

      await expectSafeRejection(
        service.create(ORG_ID, USER_ID, {
          sourceWarehouseId: 'w1',
          destWarehouseId: 'foreign-wh',
          transferNumber: 'TR-1',
        }),
      );
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('OpeningStock', () => {
    const build = (overrides?: Partial<Record<keyof MockRepo, jest.Mock>>) => {
      const repo = buildRepo(overrides);
      const audit = buildAudit();
      const service = new OpeningStockService(
        repo as unknown as OpeningStockRepository,
        audit as unknown as AuditService,
      );
      return { service, repo, audit };
    };

    it('same-org warehouse and product references succeed', async () => {
      const { service, repo } = build();
      await service.create(ORG_ID, USER_ID, {
        warehouseId: 'w1',
        productId: 'p1',
        quantity: 10,
        referenceDate: '2026-01-01',
      });

      expect(repo.verifyReferences).toHaveBeenCalledWith(ORG_ID, {
        warehouseId: 'w1',
        productId: 'p1',
        batchId: undefined,
        serialNumberId: undefined,
      });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID, warehouseId: 'w1', productId: 'p1' }),
      );
    });

    it.each([
      ['warehouse', { warehouseId: 'foreign-wh', productId: 'p1' }],
      ['product', { warehouseId: 'w1', productId: 'foreign-product' }],
      ['batch', { warehouseId: 'w1', productId: 'p1', batchId: 'foreign-batch' }],
      ['serial', { warehouseId: 'w1', productId: 'p1', serialNumberId: 'foreign-serial' }],
    ])('cross-org %s reference is rejected safely', async (_name, refs) => {
      const { service, repo, audit } = build({ verifyReferences: jest.fn().mockResolvedValue(false) });

      await expectSafeRejection(
        service.create(ORG_ID, USER_ID, {
          quantity: 1,
          referenceDate: '2026-01-01',
          ...refs,
        } as never),
      );
      expect(repo.create).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe('InventoryTransaction', () => {
    const build = (overrides?: Partial<Record<keyof MockRepo, jest.Mock>>) => {
      const repo = buildRepo(overrides);
      const audit = buildAudit();
      const service = new InventoryTransactionService(
        repo as unknown as InventoryTransactionRepository,
        audit as unknown as AuditService,
      );
      return { service, repo, audit };
    };

    it('same-org product reference succeeds', async () => {
      const { service, repo } = build();
      await service.create(ORG_ID, USER_ID, {
        productId: 'p1',
        type: TransactionType.IN,
        quantity: 5,
      });

      expect(repo.verifyReferences).toHaveBeenCalledWith(ORG_ID, { productId: 'p1' });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID, productId: 'p1' }),
      );
    });

    it('cross-org product reference is rejected safely', async () => {
      const { service, repo, audit } = build({ verifyReferences: jest.fn().mockResolvedValue(false) });

      await expectSafeRejection(
        service.create(ORG_ID, USER_ID, {
          productId: 'foreign-product',
          type: TransactionType.IN,
          quantity: 5,
        }),
      );
      expect(repo.create).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('preserves the legacy type and the independent engine transactionType', async () => {
      const { service, repo } = build();
      await service.create(ORG_ID, USER_ID, {
        productId: 'p1',
        type: TransactionType.IN,
        quantity: 5,
        transactionType: InventoryTransactionType.PURCHASE,
      });

      const data = repo.create.mock.calls[0][0];
      expect(data.type).toBe(TransactionType.IN);
      expect(data.transactionType).toBe(InventoryTransactionType.PURCHASE);
    });

    it('keeps createdById server-derived even when the payload carries one', async () => {
      const { service, repo } = build();
      await service.create(ORG_ID, USER_ID, {
        productId: 'p1',
        type: TransactionType.IN,
        quantity: 5,
        createdById: OTHER_ORG,
      } as unknown as { productId: string; type: TransactionType; quantity: number });

      const data = repo.create.mock.calls[0][0];
      expect(data.createdById).toBe(USER_ID);
      expect(data.organizationId).toBe(ORG_ID);
    });
  });
});
