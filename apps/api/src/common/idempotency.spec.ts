import { ConflictException } from '@nestjs/common';
import { TransactionType } from '@prisma/client';

import { AccountingService } from '../accounting/accounting.service';
import { InvoicesService } from '../invoices/invoices.service';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';

function createMockPrisma() {
  const journalEntries = new Map<string, Record<string, unknown>>();
  const invoices = new Map<string, Record<string, unknown>>();

  return {
    journalEntry: {
      findFirst: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
        const where = args.where as Record<string, unknown>;
        if (where.id) {
          return journalEntries.get(where.id as string) ?? null;
        }
        if (where.referenceType === 'REVERSAL') {
          for (const je of journalEntries.values()) {
            if (je.referenceType === 'REVERSAL' && je.referenceId === where.referenceId && je.organizationId === where.organizationId) {
              return je;
            }
          }
          return null;
        }
        return null;
      }),
      create: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
        const data = args.data as Record<string, unknown>;
        const id = `je-${Date.now()}-${Math.random()}`;
        const entry = {
          id,
          entryNumber: (data.entryNumber as string) ?? 'JE-2026-000001',
          date: new Date(),
          description: data.description,
          status: (data.status as string) ?? 'POSTED',
          referenceId: data.referenceId,
          referenceType: data.referenceType,
          organizationId: data.organizationId,
          lines: [],
        };
        journalEntries.set(id, entry);
        return entry;
      }),
      update: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
        const where = args.where as Record<string, unknown>;
        const data = args.data as Record<string, unknown>;
        const entry = journalEntries.get(where.id as string);
        if (entry) entry.status = data.status as string;
        return entry;
      }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    invoice: {
      findFirst: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
        const where = args.where as Record<string, unknown>;
        if (where.salesOrderId) {
          for (const inv of invoices.values()) {
            if (inv.salesOrderId === where.salesOrderId && inv.organizationId === where.organizationId) {
              return inv;
            }
          }
        }
        return null;
      }),
      create: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
        const data = args.data as Record<string, unknown>;
        const id = `inv-${Date.now()}-${Math.random()}`;
        const entry = {
          id,
          invoiceNumber: data.invoiceNumber,
          organizationId: data.organizationId,
          salesOrderId: data.salesOrderId,
          status: 'DRAFT',
          paidAmount: 0,
          subtotal: 0,
          taxTotal: 0,
          discountTotal: 0,
          total: 0,
          type: 'SALES',
          customerId: data.customerId,
          items: [],
          customer: null,
          salesOrder: null,
        };
        invoices.set(id, entry);
        return entry;
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    invoiceItem: { create: jest.fn(), deleteMany: jest.fn() },
    salesOrder: {
      findFirst: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
        const where = args.where as Record<string, unknown>;
        return {
          id: where.id,
          orderNumber: `SO-${where.id}`,
          status: 'DELIVERED',
          organizationId: where.organizationId,
          customerId: 'cust-1',
          orderDate: new Date(),
          subtotal: 100,
          discount: 0,
          tax: 0,
          total: 100,
          items: [],
        };
      }),
      findUnique: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
        const where = args.where as Record<string, unknown>;
        return {
          id: where.id,
          orderNumber: `SO-${where.id}`,
          status: 'DELIVERED',
          updatedAt: new Date(),
        };
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    customer: { findFirst: jest.fn().mockImplementation(async () => ({ id: 'cust-1', name: 'Test' })) },
    product: {
      findFirst: jest.fn().mockImplementation(async () => ({ id: 'prod-x', name: 'Product X', sku: 'SKU-X' })),
      findMany: jest.fn().mockImplementation(async () => [{ id: 'p-1', name: 'Prod', unitPrice: 100 }]),
    },
    account: { findFirst: jest.fn().mockImplementation(async () => ({ id: 'acc-1', code: '1000', name: 'Cash', type: 'ASSET' })) },
    receivable: { findFirst: jest.fn().mockResolvedValue(null) },
    payable: { findFirst: jest.fn().mockResolvedValue(null) },
    inventory: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
        const data = args.data as Record<string, unknown>;
        return { id: `inv-${data.productId}`, quantity: data.quantity };
      }),
    },
    inventoryTransaction: { create: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
    journalEntries,
    invoices,
  };
}

function createAuditService() {
  return { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
}

function createMailService() {
  return { sendOrgEmail: jest.fn().mockResolvedValue(undefined) } as unknown as MailService;
}

function setupTransactionMock(mockPrisma: Record<string, unknown>) {
  const invoicesMap = (mockPrisma as ReturnType<typeof createMockPrisma>).invoices;
  ((mockPrisma as ReturnType<typeof createMockPrisma>) as unknown as Record<string, jest.Mock>).$transaction.mockImplementation(async (fn: (...fnArgs: unknown[]) => Promise<unknown>) => fn({
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn().mockImplementation(async (..._args: unknown[]) => []),
    customer: { findFirst: jest.fn().mockImplementation(async () => ({ id: 'cust-1', name: 'Test' })) },
    product: { findFirst: jest.fn().mockImplementation(async () => ({ id: 'prod-x', name: 'Product X', sku: 'SKU-X' })), findMany: jest.fn().mockImplementation(async () => [{ id: 'p-1', name: 'Prod', unitPrice: 100 }]) },
    invoice: {
      findFirst: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
        const where = args.where as Record<string, unknown>;
        const salesOrderId = where.salesOrderId;
        if (salesOrderId) {
          for (const inv of invoicesMap.values()) {
            if (inv.salesOrderId === salesOrderId && inv.organizationId === where.organizationId) {
              return inv;
            }
          }
          return null;
        }
        return null;
      }),
      create: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
        const data = args.data as Record<string, unknown>;
        const id = `inv-tx-${Date.now()}`;
        const entry = { id, invoiceNumber: data.invoiceNumber, status: 'DRAFT', salesOrderId: data.salesOrderId, organizationId: data.organizationId, items: [] };
        invoicesMap.set(id, entry);
        return entry;
      }),
    },
    invoiceItem: { create: jest.fn() },
    salesOrder: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
        const where = args.where as Record<string, unknown>;
        return { id: where.id, orderNumber: 'SO-TX', status: 'DELIVERED', updatedAt: new Date() };
      }),
    },
    journalEntry: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
        const data = args.data as Record<string, unknown>;
        return {
          id: `je-tx-${Date.now()}`,
          entryNumber: (data.entryNumber as string) ?? 'JE-TX-000001',
          date: new Date(),
          status: (data.status as string) ?? 'POSTED',
          description: data.description,
          referenceId: data.referenceId,
          referenceType: data.referenceType,
          lines: [],
        };
      }),
    },
    account: { findFirst: jest.fn().mockImplementation(async () => ({ id: 'acc-tx', code: '1000', name: 'Cash', type: 'ASSET' })) },
    inventory: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn(),
      create: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
        const data = args.data as Record<string, unknown>;
        return { id: `inv-tx-${data.productId}`, quantity: data.quantity };
      }),
    },
    inventoryTransaction: { create: jest.fn() },
    salesOrderItem: { deleteMany: jest.fn(), createMany: jest.fn() },
    payable: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    receivable: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
  }));
}

describe('Idempotency Tests', () => {
  describe('A. Journal reversal — duplicate rejection', () => {
    it('should reject duplicate journal reversal with ConflictException', async () => {
      const mockPrisma = createMockPrisma();
      const service = new AccountingService(mockPrisma as unknown as PrismaService);

      const entryId = 'je-reverse-twice';
      mockPrisma.journalEntries.set(entryId, {
        id: entryId,
        status: 'POSTED',
        organizationId: 'org-1',
        description: 'Test entry',
        entryNumber: 'JE-2026-000001',
      });

      const reversalId = 'je-reversal-existing';
      mockPrisma.journalEntries.set(reversalId, {
        id: reversalId,
        status: 'POSTED',
        referenceType: 'REVERSAL',
        referenceId: entryId,
        organizationId: 'org-1',
      });

      mockPrisma.journalEntry.findFirst.mockImplementation(async (args: Record<string, unknown>) => {
        const where = args.where as Record<string, unknown>;
        if (where.id === entryId) {
          return { id: entryId, status: 'POSTED', description: 'Test entry', entryNumber: 'JE-2026-000001', organizationId: 'org-1', lines: [] };
        }
        if (where.referenceType === 'REVERSAL' && where.referenceId === entryId) {
          return { id: reversalId, referenceType: 'REVERSAL', referenceId: entryId };
        }
        return null;
      });

      await expect(
        service.reverseJournalEntry('org-1', 'user-1', entryId),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.journalEntry.create).not.toHaveBeenCalled();
    });

    it('should succeed first reversal then reject second', async () => {
      const mockPrisma = createMockPrisma();
      const service = new AccountingService(mockPrisma as unknown as PrismaService);

      const entryId = 'je-reverse-seq';
      mockPrisma.journalEntries.set(entryId, {
        id: entryId,
        status: 'POSTED',
        organizationId: 'org-1',
      });

      let reversalExists = false;
      mockPrisma.journalEntry.findFirst.mockImplementation(async (args: Record<string, unknown>) => {
        const where = args.where as Record<string, unknown>;
        if (where.id === entryId) {
          return { id: entryId, status: 'POSTED', description: 'Original', entryNumber: 'JE-2026-000005', lines: [] };
        }
        if (where.referenceType === 'REVERSAL' && where.referenceId === entryId) {
          if (reversalExists) return { id: 'rev-1', referenceType: 'REVERSAL' };
          return null;
        }
        return null;
      });

      const reversalResult = await service.reverseJournalEntry('org-1', 'user-1', entryId);
      expect(reversalResult).toBeDefined();
      reversalExists = true;

      await expect(
        service.reverseJournalEntry('org-1', 'user-1', entryId),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('B. Create invoice from same sales order — duplicate rejection', () => {
    it('should reject creating a second invoice for the same sales order', async () => {
      const mockPrisma = createMockPrisma();
      setupTransactionMock(mockPrisma as unknown as Record<string, unknown>);
      const service = new InvoicesService(mockPrisma as unknown as PrismaService, createAuditService(), createMailService(), { updateReceivableOverdueStatuses: jest.fn().mockResolvedValue(0), updatePayableOverdueStatuses: jest.fn().mockResolvedValue(0) } as never);

      const salesOrderId = 'so-duplicate-invoice';
      const existingInvoice = { id: 'existing-invoice', invoiceNumber: 'INV-2026-000001', salesOrderId, organizationId: 'org-1' };
      mockPrisma.invoices.set('existing-invoice', existingInvoice);

      await expect(
        service.createFromOrder('org-1', 'user-1', salesOrderId),
      ).rejects.toThrow(ConflictException);
    });

    it('should succeed first create then reject second for same order', async () => {
      const mockPrisma = createMockPrisma();
      setupTransactionMock(mockPrisma as unknown as Record<string, unknown>);
      const service = new InvoicesService(mockPrisma as unknown as PrismaService, createAuditService(), createMailService(), { updateReceivableOverdueStatuses: jest.fn().mockResolvedValue(0), updatePayableOverdueStatuses: jest.fn().mockResolvedValue(0) } as never);

      const salesOrderId = 'so-dup-seq';

      const result = await service.createFromOrder('org-1', 'user-1', salesOrderId);
      expect(result).toBeDefined();
      expect(result.invoiceNumber).toMatch(/^INV-/);

      await expect(
        service.createFromOrder('org-1', 'user-1', salesOrderId),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('C. Update overdue statuses — idempotent operation', () => {
    it('should be idempotent when called twice (no harm from double execution)', async () => {
      const mockPrisma = createMockPrisma();
      const service = new InvoicesService(mockPrisma as unknown as PrismaService, createAuditService(), createMailService(), { updateReceivableOverdueStatuses: jest.fn().mockResolvedValue(0), updatePayableOverdueStatuses: jest.fn().mockResolvedValue(0) } as never);

      mockPrisma.invoice.updateMany.mockResolvedValue({ count: 3 });

      const count1 = await service.updateOverdueStatuses('org-1');
      expect(count1).toBe(3);

      const count2 = await service.updateOverdueStatuses('org-1');
      expect(count2).toBe(3);

      expect(mockPrisma.invoice.updateMany).toHaveBeenCalledTimes(2);
      expect(mockPrisma.invoice.updateMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: { paymentStatus: 'OVERDUE' },
        }),
      );
    });

    it('should return 0 when called with no overdue invoices', async () => {
      const mockPrisma = createMockPrisma();
      const service = new InvoicesService(mockPrisma as unknown as PrismaService, createAuditService(), createMailService(), { updateReceivableOverdueStatuses: jest.fn().mockResolvedValue(0), updatePayableOverdueStatuses: jest.fn().mockResolvedValue(0) } as never);

      mockPrisma.invoice.updateMany.mockResolvedValue({ count: 0 });

      const count1 = await service.updateOverdueStatuses('org-1');
      const count2 = await service.updateOverdueStatuses('org-1');
      expect(count1).toBe(0);
      expect(count2).toBe(0);
    });
  });

  describe('D. Stock adjustment IN — atomic increments via transaction', () => {
    it('should handle IN operations atomically within transaction', async () => {
      const mockPrisma = createMockPrisma();

      let currentQty = 5;

      (mockPrisma as unknown as Record<string, jest.Mock>).$transaction.mockImplementation(async (fn: (...fnArgs: unknown[]) => Promise<unknown>) => {
        const tx = {
          $queryRaw: jest.fn().mockImplementation(async () => {
            if (currentQty > 0) return [{ id: 'inv-prod-x', quantity: currentQty }];
            return [];
          }),
          product: { findFirst: jest.fn().mockImplementation(async () => ({ id: 'prod-x', name: 'Product X', sku: 'SKU-X' })) },
          inventory: {
            findFirst: jest.fn().mockImplementation(async () => {
              if (currentQty > 0) return { id: 'inv-prod-x', productId: 'prod-x', quantity: currentQty, organizationId: 'org-1', warehouseId: null };
              return null;
            }),
            findUnique: jest.fn().mockImplementation(async () => ({ id: 'inv-prod-x', productId: 'prod-x', quantity: currentQty, organizationId: 'org-1', warehouseId: null })),
            update: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
              const data = args.data as Record<string, unknown>;
              currentQty = data.quantity as number;
              return { id: (args.where as Record<string, unknown>).id, quantity: currentQty };
            }),
            updateMany: jest.fn().mockImplementation(async () => {
              currentQty += 5;
              return { count: 1 };
            }),
            create: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
              const data = args.data as Record<string, unknown>;
              currentQty = data.quantity as number;
              return { id: 'inv-prod-x', productId: 'prod-x', quantity: currentQty, organizationId: 'org-1', warehouseId: null };
            }),
          },
          inventoryTransaction: { create: jest.fn() },
        };
        return fn(tx);
      });

      const service = new InventoryService(mockPrisma as unknown as PrismaService, createAuditService());

      const result = await service.adjust('org-1', 'user-1', {
        productId: 'prod-x',
        type: 'IN' as TransactionType,
        quantity: 5,
        notes: 'test in',
      });

      expect(result).toBeDefined();
      expect(result.newQuantity).toBe(10);
      expect(currentQty).toBe(10);
    });
  });

  describe('E. Posting a draft journal entry — idempotent guard', () => {
    it('should reject posting a non-DRAFT entry', async () => {
      const mockPrisma = createMockPrisma();
      const service = new AccountingService(mockPrisma as unknown as PrismaService);

      const entryId = 'je-already-posted';
      mockPrisma.journalEntry.findFirst.mockImplementation(async (args: Record<string, unknown>) => {
        const where = args.where as Record<string, unknown>;
        if (where.id === entryId) {
          return { id: entryId, status: 'POSTED', description: 'Already posted', entryNumber: 'JE-2026-000009', lines: [] };
        }
        return null;
      });

      await expect(
        service.postJournalEntry('org-1', 'user-1', entryId),
      ).rejects.toThrow(ConflictException);
    });

    it('should successfully post a DRAFT entry', async () => {
      const mockPrisma = createMockPrisma();
      const service = new AccountingService(mockPrisma as unknown as PrismaService);

      const entryId = 'je-draft';
      mockPrisma.journalEntry.findFirst.mockImplementation(async (args: Record<string, unknown>) => {
        const where = args.where as Record<string, unknown>;
        if (where.id === entryId) {
          return { id: entryId, status: 'DRAFT', description: 'Draft entry', entryNumber: 'JE-2026-000010', lines: [{ debit: 100, credit: 100 }] };
        }
        return null;
      });

      mockPrisma.journalEntry.update.mockImplementation(async (args: Record<string, unknown>) => {
        const where = args.where as Record<string, unknown>;
        const data = args.data as Record<string, unknown>;
        return { id: where.id, entryNumber: 'JE-2026-000010', status: data.status, date: new Date() };
      });

      const result = await service.postJournalEntry('org-1', 'user-1', entryId);
      expect(result.status).toBe('POSTED');
    });
  });
});
