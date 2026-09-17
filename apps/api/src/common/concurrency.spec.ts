import { Prisma, TransactionType } from '@prisma/client';
import { ConflictException } from '@nestjs/common';

import { InvoicesService } from '../invoices/invoices.service';
import { AccountingService } from '../accounting/accounting.service';
import { InventoryService } from '../inventory/inventory.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { CreateInvoiceDto } from '../invoices/dto/create-invoice.dto';

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('mock error', { code, clientVersion: '0.0.0' });
}

function createMockPrisma() {
  let invoiceSeq = 0;
  const invoices = new Map<string, { id: string; invoiceNumber: string; organizationId: string; salesOrderId?: string }>();
  const journalEntries = new Map<string, { id: string; status?: string; referenceType?: string; referenceId?: string; organizationId?: string }>();
  const inventoryRows = new Map<string, { id: string; productId: string; quantity: number; organizationId: string; warehouseId: null }>();

  const prisma = {
    customer: {
      findFirst: jest.fn().mockImplementation(async () => ({ id: 'cust-1', name: 'Test Customer' })),
    },
    product: {
      findFirst: jest.fn().mockImplementation(async () => ({ id: 'p-1', name: 'Test Product', sku: 'SKU-1' })),
      findMany: jest.fn().mockImplementation(async () => [{ id: 'p-1', name: 'Test Product', unitPrice: 100 }]),
    },
    invoice: {
      findFirst: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
        const where = args.where as Record<string, unknown>;
        const orgId = where.organizationId;
        const invoiceNumber = where.invoiceNumber;
        const prefix = typeof invoiceNumber === 'string' ? invoiceNumber : '';
        const salesOrderId = where.salesOrderId;
        if (salesOrderId) {
          for (const inv of invoices.values()) {
            if (inv.salesOrderId === salesOrderId && inv.organizationId === orgId) {
              return inv;
            }
          }
          return null;
        }
        let maxSeq = 0;
        for (const inv of invoices.values()) {
          if (inv.organizationId === orgId && inv.invoiceNumber.startsWith(prefix)) {
            const seq = parseInt(inv.invoiceNumber.split('-').pop() ?? '', 10);
            if (seq > maxSeq) maxSeq = seq;
          }
        }
        return maxSeq > 0
          ? { invoiceNumber: `${prefix}${String(maxSeq).padStart(6, '0')}` }
          : null;
      }),
      create: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
        const data = args.data as Record<string, unknown>;
        const num = data.invoiceNumber;
        for (const inv of invoices.values()) {
          if (inv.invoiceNumber === num && inv.organizationId === data.organizationId) {
            throw prismaError('P2002');
          }
        }
        invoiceSeq++;
        const id = `inv-${invoiceSeq}`;
        const entry = { id, invoiceNumber: num as string, organizationId: data.organizationId as string, salesOrderId: (data.salesOrderId as string) ?? null };
        invoices.set(id, entry);
        return {
          ...entry,
          status: 'DRAFT',
          paidAmount: 0,
          subtotal: 0,
          taxTotal: 0,
          discountTotal: 0,
          total: 0,
          type: 'SALES',
          customerId: 'cust-1',
          issueDate: new Date(),
          dueDate: null,
          notes: null,
          createdById: 'user-1',
          items: [],
        };
      }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    invoiceItem: { create: jest.fn(), deleteMany: jest.fn() },
    salesOrder: {
      findFirst: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
        const where = args.where as Record<string, unknown>;
        return {
          id: where.id,
          orderNumber: `SO-TEST-${where.id}`,
          status: 'DELIVERED',
          organizationId: where.organizationId,
          customerId: 'cust-1',
          orderDate: new Date(),
          subtotal: 0,
          discount: 0,
          tax: 0,
          total: 0,
          items: [],
        };
      }),
      findUnique: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
        const where = args.where as Record<string, unknown>;
        return {
          id: where.id,
          orderNumber: `SO-TEST-${where.id}`,
          status: 'DELIVERED',
          updatedAt: new Date(),
        };
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    salesOrderItem: { deleteMany: jest.fn(), createMany: jest.fn() },
    journalEntry: {
      findFirst: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
        const where = args.where as Record<string, unknown>;
        if (where.id) {
          return journalEntries.get(where.id as string) ?? null;
        }
        if (where.referenceId && where.referenceType) {
          for (const je of journalEntries.values()) {
            if (je.referenceType === where.referenceType && je.referenceId === where.referenceId && je.organizationId === where.organizationId) {
              return je;
            }
          }
        }
        return null;
      }),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
        const data = args.data as Record<string, unknown>;
        const jeId = `je-${Date.now()}-${Math.random()}`;
        const entry = {
          id: jeId,
          entryNumber: (data.entryNumber as string) ?? 'JE-2026-000001',
          date: new Date(),
          description: data.description,
          status: (data.status as string) ?? 'POSTED',
          referenceId: data.referenceId as string | undefined,
          referenceType: data.referenceType as string | undefined,
          organizationId: data.organizationId as string | undefined,
          lines: [],
        };
        journalEntries.set(jeId, entry);
        return entry;
      }),
      update: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
        const where = args.where as Record<string, unknown>;
        const data = args.data as Record<string, unknown>;
        const entry = journalEntries.get(where.id as string);
        if (entry) entry.status = data.status as string;
        return entry;
      }),
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn(),
    },
    journalEntryLine: { create: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
    account: {
      findFirst: jest.fn().mockImplementation(async () => ({ id: 'acc-1', code: '1000', name: 'Cash', type: 'ASSET' })),
      findMany: jest.fn().mockResolvedValue([]),
    },
    receivable: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    payable: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    payment: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    paymentAllocation: { create: jest.fn() },
    inventory: {
      findFirst: jest.fn().mockImplementation(async () => null),
      findUnique: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
        const where = args.where as Record<string, unknown>;
        for (const row of inventoryRows.values()) {
          if (row.id === where.id) return row;
        }
        return null;
      }),
      update: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
        const where = args.where as Record<string, unknown>;
        const data = args.data as Record<string, unknown>;
        for (const row of inventoryRows.values()) {
          if (row.id === where.id) {
            const qty = data.quantity as Record<string, unknown> | number;
            if (typeof qty === 'object' && qty !== null && 'increment' in qty) {
              row.quantity += (qty as Record<string, number>).increment;
            } else if (typeof qty === 'object' && qty !== null && 'decrement' in qty) {
              row.quantity -= (qty as Record<string, number>).decrement;
            } else {
              row.quantity = qty as number;
            }
            return row;
          }
        }
        return null;
      }),
      updateMany: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
        const where = args.where as Record<string, unknown>;
        const data = args.data as Record<string, unknown>;
        for (const row of inventoryRows.values()) {
          if (where.id && row.id === where.id) {
            if (where.quantity && typeof where.quantity === 'object' && 'gte' in where.quantity) {
              const whereQuantity = where.quantity as Record<string, number>;
              if (row.quantity < whereQuantity.gte) return { count: 0 };
            }
            const qty = data.quantity as Record<string, unknown> | number;
            if (typeof qty === 'object' && qty !== null && 'increment' in qty) {
              row.quantity += (qty as Record<string, number>).increment;
            } else if (typeof qty === 'object' && qty !== null && 'decrement' in qty) {
              row.quantity -= (qty as Record<string, number>).decrement;
            } else {
              row.quantity = qty as number;
            }
            return { count: 1 };
          }
        }
        return { count: 0 };
      }),
      create: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
        const data = args.data as Record<string, unknown>;
        const row = { id: `inv-${data.productId}`, productId: data.productId as string, quantity: data.quantity as number, organizationId: data.organizationId as string, warehouseId: null };
        inventoryRows.set(data.productId as string, row);
        return row;
      }),
    },
    inventoryTransaction: { create: jest.fn() },
    purchaseOrder: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    purchaseOrderItem: { deleteMany: jest.fn(), createMany: jest.fn() },
    organization: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([]),
    $executeRaw: jest.fn(),
    inventoryRows,
    invoices,
    journalEntries,
    setInventoryRow(productId: string, id: string, quantity: number) {
      inventoryRows.set(productId, { id, productId, quantity, organizationId: 'org-1', warehouseId: null });
    },
  };

  prisma.$transaction.mockImplementation(async (fn: (...callbackArgs: unknown[]) => Promise<unknown>) => fn({
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn().mockImplementation(async (..._args: unknown[]) => {
      const parts = Array.isArray(_args[0]) ? (_args[0] as string[]).join('') : String(_args[0] ?? '');
      if (parts.includes('FOR UPDATE')) {
        for (const row of inventoryRows.values()) {
          return [{ id: row.id, quantity: row.quantity }];
        }
      }
      return [];
    }),
    customer: prisma.customer,
    product: prisma.product,
    invoice: prisma.invoice,
    invoiceItem: prisma.invoiceItem,
    salesOrder: prisma.salesOrder,
    salesOrderItem: prisma.salesOrderItem,
    journalEntry: prisma.journalEntry,
    journalEntryLine: prisma.journalEntryLine,
    account: prisma.account,
    receivable: prisma.receivable,
    payable: prisma.payable,
    inventory: prisma.inventory,
    inventoryTransaction: prisma.inventoryTransaction,
    purchaseOrder: prisma.purchaseOrder,
    purchaseOrderItem: prisma.purchaseOrderItem,
  }));

  return prisma;
}

function createAuditService() {
  return { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
}

function createMailService() {
  return { sendOrgEmail: jest.fn().mockResolvedValue(undefined) } as unknown as MailService;
}

describe('Concurrency Tests', () => {
  describe('A. Invoice number generation — concurrent unique numbers', () => {
    it('should produce different invoice numbers under concurrent requests via create', async () => {
      const mockPrisma = createMockPrisma();
      const service = new InvoicesService(mockPrisma as unknown as never, createAuditService(), createMailService());

      const dto = {
        customerId: 'cust-1',
        items: [{ productId: 'p-1', quantity: 1, unitPrice: 100 }],
        issueDate: '2026-01-01',
      };

      const results = await Promise.all([
        service.create('org-1', 'user-1', dto as unknown as CreateInvoiceDto),
        service.create('org-1', 'user-1', dto as unknown as CreateInvoiceDto),
        service.create('org-1', 'user-1', dto as unknown as CreateInvoiceDto),
        service.create('org-1', 'user-1', dto as unknown as CreateInvoiceDto),
      ]);

      const numbers = results.map((r) => r.invoiceNumber);
      const unique = new Set(numbers);
      expect(unique.size).toBe(4);
      for (const num of numbers) {
        expect(num).toMatch(/^INV-\d{4}-\d{6}$/);
      }
    });

    it('should recover from P2002 and produce unique numbers', async () => {
      const mockPrisma = createMockPrisma();
      const service = new InvoicesService(mockPrisma as unknown as never, createAuditService(), createMailService());

      let createCalls = 0;
      mockPrisma.invoice.create.mockImplementation(async (args: Record<string, unknown>) => {
        const data = args.data as Record<string, unknown>;
        createCalls++;
        if (createCalls === 1) {
          throw prismaError('P2002');
        }
        const num = data.invoiceNumber;
        const id = `inv-${createCalls}`;
        const entry = { id, invoiceNumber: num as string, organizationId: data.organizationId as string };
        mockPrisma.invoices.set(id, entry);
        return {
          ...entry,
          status: 'DRAFT',
          paidAmount: 0,
          subtotal: 0,
          taxTotal: 0,
          discountTotal: 0,
          total: 0,
          type: 'SALES',
          customerId: 'cust-1',
          items: [],
        };
      });

      const dto = {
        customerId: 'cust-1',
        items: [{ productId: 'p-1', quantity: 1, unitPrice: 100 }],
        issueDate: '2026-01-01',
      };

      const results = await Promise.all([
        service.create('org-1', 'user-1', dto as unknown as CreateInvoiceDto),
        service.create('org-1', 'user-1', dto as unknown as CreateInvoiceDto),
      ]);

      const numbers = results.map((r) => r.invoiceNumber);
      const unique = new Set(numbers);
      expect(unique.size).toBe(2);
    });

    it('should not produce duplicate numbers across different orgs', async () => {
      const mockPrisma = createMockPrisma();
      const service = new InvoicesService(mockPrisma as unknown as never, createAuditService(), createMailService());

      const makeDto = () => ({
        customerId: 'cust-1',
        items: [{ productId: 'p-1', quantity: 1, unitPrice: 100 }],
        issueDate: '2026-01-01',
      });

      const [rA1, rA2, rB1, rB2] = await Promise.all([
        service.create('org-a', 'user-1', makeDto() as unknown as CreateInvoiceDto),
        service.create('org-a', 'user-1', makeDto() as unknown as CreateInvoiceDto),
        service.create('org-b', 'user-1', makeDto() as unknown as CreateInvoiceDto),
        service.create('org-b', 'user-1', makeDto() as unknown as CreateInvoiceDto),
      ]);

      expect(rA1.invoiceNumber).not.toBe(rA2.invoiceNumber);
      expect(rB1.invoiceNumber).not.toBe(rB2.invoiceNumber);

      const orgANums = [rA1.invoiceNumber, rA2.invoiceNumber];
      const orgBNums = [rB1.invoiceNumber, rB2.invoiceNumber];
      expect(new Set(orgANums).size).toBe(orgANums.length);
      expect(new Set(orgBNums).size).toBe(orgBNums.length);
    });
  });

  describe('B. Journal reversal — concurrent idempotency guard', () => {
    it('should only allow one reversal per journal entry under concurrent requests', async () => {
      const mockPrisma = createMockPrisma();
      const service = new AccountingService(mockPrisma as unknown as never);

      const entryId = 'je-to-reverse';
      mockPrisma.journalEntries.set(entryId, {
        id: entryId,
        status: 'POSTED',
        referenceType: undefined,
      });

      mockPrisma.journalEntry.findFirst.mockImplementation(async (args: Record<string, unknown>) => {
        const where = args.where as Record<string, unknown>;
        if (where.id === entryId) {
          return { id: entryId, status: 'POSTED', description: 'Original', entryNumber: 'JE-2026-000001', lines: [{ accountId: 'a1', debit: 100, credit: 0, description: 'line1' }, { accountId: 'a2', debit: 0, credit: 100, description: 'line2' }] };
        }
        if (where.referenceType === 'REVERSAL' && where.referenceId === entryId) {
          if (mockPrisma.journalEntries.has('reversal-1')) {
            return { id: 'reversal-1', referenceType: 'REVERSAL' };
          }
          return null;
        }
        return null;
      });

      let createCount = 0;
      mockPrisma.journalEntry.create.mockImplementation(async () => {
        createCount++;
        if (createCount === 1) {
          const id = 'reversal-1';
          const entry = { id, status: 'POSTED', referenceType: 'REVERSAL', referenceId: entryId, organizationId: 'org-1' };
          mockPrisma.journalEntries.set(id, entry);
          return {
            ...entry,
            entryNumber: 'JE-2026-000002',
            date: new Date(),
            description: 'Reversal of JE-2026-000001',
            status: 'POSTED',
            lines: [],
          };
        }
        throw prismaError('P2002');
      });

      const results = await Promise.allSettled([
        service.reverseJournalEntry('org-1', 'user-1', entryId),
        service.reverseJournalEntry('org-1', 'user-1', entryId),
      ]);

      const successes = results.filter((r) => r.status === 'fulfilled');
      const _failures = results.filter((r) => r.status === 'rejected');

      expect(successes.length).toBe(1);
      expect(_failures.length).toBe(1);
    });

    it('should reject reversal of already-reversed entry', async () => {
      const mockPrisma = createMockPrisma();
      const service = new AccountingService(mockPrisma as unknown as never);

      const entryId = 'je-already-reversed';
      mockPrisma.journalEntry.findFirst.mockImplementation(async (args: Record<string, unknown>) => {
        const where = args.where as Record<string, unknown>;
        if (where.id === entryId) {
          return { id: entryId, status: 'POSTED', description: 'Original', entryNumber: 'JE-2026-000003', lines: [] };
        }
        if (where.referenceType === 'REVERSAL' && where.referenceId === entryId) {
          return { id: 'prev-reversal', referenceType: 'REVERSAL' };
        }
        return null;
      });

      await expect(
        service.reverseJournalEntry('org-1', 'user-1', entryId),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('C. Stock adjustment — concurrent safety', () => {
    it('should not produce negative stock under concurrent OUT operations', async () => {
      const mockPrisma = createMockPrisma();
      const service = new InventoryService(mockPrisma as unknown as never, createAuditService());

      mockPrisma.setInventoryRow('prod-1', 'inv-prod-1', 10);

      mockPrisma.inventory.findFirst.mockImplementation(async () => {
        return mockPrisma.inventoryRows.get('prod-1') ?? null;
      });

      const dto = { productId: 'prod-1', type: 'OUT' as TransactionType, quantity: 5, notes: 'test out' };

      const results = await Promise.allSettled([
        service.adjust('org-1', 'user-1', dto),
        service.adjust('org-1', 'user-1', dto),
      ]);

      const successes = results.filter((r) => r.status === 'fulfilled');
      const _failures = results.filter((r) => r.status === 'rejected');

      expect(successes.length + _failures.length).toBe(2);

      const finalInventory = mockPrisma.inventoryRows.get('prod-1');
      expect(finalInventory?.quantity ?? 0).toBeGreaterThanOrEqual(0);
      expect(finalInventory?.quantity ?? 0).toBeLessThanOrEqual(10);
    });

    it('should correctly handle concurrent IN operations (atomic increment)', async () => {
      const mockPrisma = createMockPrisma();
      const service = new InventoryService(mockPrisma as unknown as never, createAuditService());

      mockPrisma.setInventoryRow('prod-2', 'inv-prod-2', 0);

      mockPrisma.inventory.findFirst.mockImplementation(async () => {
        return mockPrisma.inventoryRows.get('prod-2') ?? null;
      });

      const dto = { productId: 'prod-2', type: 'IN' as TransactionType, quantity: 10, notes: 'test in' };

      const results = await Promise.all([
        service.adjust('org-1', 'user-1', dto),
        service.adjust('org-1', 'user-1', dto),
      ]);

      expect(results.length).toBe(2);

      const finalInventory = mockPrisma.inventoryRows.get('prod-2');
      expect(finalInventory?.quantity ?? 0).toBe(20);
    });

    it('should handle concurrent ADJUSTMENT operations (last-write-wins)', async () => {
      const mockPrisma = createMockPrisma();
      const service = new InventoryService(mockPrisma as unknown as never, createAuditService());

      mockPrisma.setInventoryRow('prod-3', 'inv-prod-3', 50);

      mockPrisma.inventory.findFirst.mockImplementation(async () => {
        return mockPrisma.inventoryRows.get('prod-3') ?? null;
      });

      const results = await Promise.all([
        service.adjust('org-1', 'user-1', { productId: 'prod-3', type: 'ADJUSTMENT' as TransactionType, quantity: 100, notes: 'set to 100' }),
        service.adjust('org-1', 'user-1', { productId: 'prod-3', type: 'ADJUSTMENT' as TransactionType, quantity: 200, notes: 'set to 200' }),
      ]);

      expect(results.length).toBe(2);

      const finalInventory = mockPrisma.inventoryRows.get('prod-3');
      expect([100, 200]).toContain(finalInventory?.quantity ?? 0);
    });

    it('should prevent overselling when concurrent OUT exceeds available stock', async () => {
      const mockPrisma = createMockPrisma();
      const service = new InventoryService(mockPrisma as unknown as never, createAuditService());

      mockPrisma.setInventoryRow('prod-4', 'inv-prod-4', 8);

      mockPrisma.inventory.findFirst.mockImplementation(async () => {
        return mockPrisma.inventoryRows.get('prod-4') ?? null;
      });

      const results = await Promise.allSettled([
        service.adjust('org-1', 'user-1', { productId: 'prod-4', type: 'OUT' as TransactionType, quantity: 5, notes: 'out 1' }),
        service.adjust('org-1', 'user-1', { productId: 'prod-4', type: 'OUT' as TransactionType, quantity: 5, notes: 'out 2' }),
      ]);

      const successes = results.filter((r) => r.status === 'fulfilled');
      const _failures = results.filter((r) => r.status === 'rejected');

      expect(successes.length).toBeGreaterThanOrEqual(1);

      const finalInventory = mockPrisma.inventoryRows.get('prod-4');
      expect(finalInventory?.quantity ?? 0).toBeGreaterThanOrEqual(0);
      expect(finalInventory?.quantity ?? 0).toBeLessThanOrEqual(8);
    });
  });
});
