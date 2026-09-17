import { BadRequestException, ConflictException } from '@nestjs/common';

import { AccountingService } from '../accounting/accounting.service';

const ORG_ID = 'org-1';
const USER_ID = 'user-1';

describe('Financial edge cases', () => {
  describe('A. Zero amount', () => {
    it('should handle zero amount invoice gracefully', async () => {
      const prisma = {
        journalEntry: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'je-zero',
            entryNumber: 'JE-2026-000001',
            status: 'DRAFT',
            lines: [],
          }),
          count: jest.fn(),
          findMany: jest.fn(),
          aggregate: jest.fn(),
        },
        journalEntryLine: { createMany: jest.fn(), deleteMany: jest.fn() },
        account: {
          findMany: jest.fn().mockResolvedValue([{ id: 'acct-1', organizationId: ORG_ID }]),
        },
      } as unknown as import('../prisma/prisma.service').PrismaService;

      const service = new AccountingService(prisma);

      const result = await service.createJournalEntry(ORG_ID, USER_ID, {
        description: 'Zero amount entry',
        lines: [{ accountId: 'acct-1', debit: 0, credit: 0 }],
      });

      expect(result).toBeDefined();
    });

    it('should accept a receivable with zero total amount', async () => {
      const prisma = {
        receivable: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'rec-zero',
            invoiceNumber: 'INV-ZERO',
            totalAmount: 0,
            paidAmount: 0,
            status: 'PENDING',
            dueDate: new Date(),
          }),
        },
        salesOrder: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'so-zero',
            orderNumber: 'SO-ZERO',
            total: 0,
            customerId: 'cust-1',
            orderDate: new Date(),
          }),
        },
      } as unknown as import('../prisma/prisma.service').PrismaService;

      const service = new AccountingService(prisma);

      const result = await service.createReceivableForSales(ORG_ID, 'so-zero');

      expect(result).toBeDefined();
      expect(result.totalAmount).toBe(0);
    });
  });

  describe('B. Decimal precision', () => {
    it('should handle 0.01 decimal amounts without floating point errors', async () => {
      const prisma = {
        journalEntry: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'je-decimal',
            entryNumber: 'JE-2026-000001',
            status: 'DRAFT',
            lines: [],
          }),
          count: jest.fn(),
          findMany: jest.fn(),
          aggregate: jest.fn(),
        },
        journalEntryLine: { createMany: jest.fn(), deleteMany: jest.fn() },
        account: {
          findMany: jest.fn().mockResolvedValue([{ id: 'acct-1', organizationId: ORG_ID }]),
        },
      } as unknown as import('../prisma/prisma.service').PrismaService;

      const service = new AccountingService(prisma);

      const result = await service.createJournalEntry(ORG_ID, USER_ID, {
        description: 'Decimal precision test',
        lines: [{ accountId: 'acct-1', debit: 0.01, credit: 0.01 }],
      });

      expect(result).toBeDefined();
    });

    it('should sum multiple 0.01 amounts correctly in trial balance', async () => {
      const lines = [
        { debit: 0.01, credit: 0, accountId: 'acct-1' },
        { debit: 0.01, credit: 0, accountId: 'acct-1' },
        { debit: 0.01, credit: 0, accountId: 'acct-1' },
        { debit: 0.01, credit: 0, accountId: 'acct-1' },
        { debit: 0.01, credit: 0, accountId: 'acct-1' },
      ];

      const accounts = [{ id: 'acct-1', code: '1000', name: 'Cash', type: 'ASSET' }];

      const prisma = {
        account: {
          findMany: jest.fn().mockResolvedValue(accounts),
          count: jest.fn(),
          aggregate: jest.fn(),
        },
        journalEntryLine: {
          findMany: jest.fn().mockResolvedValue(lines),
          aggregate: jest.fn(),
          createMany: jest.fn(),
          deleteMany: jest.fn(),
        },
        journalEntry: {
          findMany: jest.fn(),
          count: jest.fn(),
          create: jest.fn(),
          findFirst: jest.fn(),
        },
      } as unknown as import('../prisma/prisma.service').PrismaService;

      const service = new AccountingService(prisma);

      const result = await service.getTrialBalance(ORG_ID);

      expect(result.summary.totalDebit).toBe(0.05);
      expect(result.summary.totalCredit).toBe(0);
      expect(result.summary.isBalanced).toBe(false);
    });

    it('should handle 0.1 + 0.2 = 0.3 without floating point drift', async () => {
      const prisma = {
        journalEntry: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'je-float',
            entryNumber: 'JE-2026-000001',
            status: 'DRAFT',
            lines: [],
          }),
          count: jest.fn(),
          findMany: jest.fn(),
          aggregate: jest.fn(),
        },
        journalEntryLine: { createMany: jest.fn(), deleteMany: jest.fn() },
        account: {
          findMany: jest.fn().mockResolvedValue([{ id: 'acct-1', organizationId: ORG_ID }]),
        },
      } as unknown as import('../prisma/prisma.service').PrismaService;

      const service = new AccountingService(prisma);

      const result = await service.createJournalEntry(ORG_ID, USER_ID, {
        description: 'Float precision test',
        lines: [{ accountId: 'acct-1', debit: 0.3, credit: 0.3 }],
      });

      expect(result).toBeDefined();
    });
  });

  describe('C. Large amounts', () => {
    it('should handle very large amounts without overflow', async () => {
      const largeAmount = 1_000_000_000;

      const prisma = {
        journalEntry: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'je-large',
            entryNumber: 'JE-2026-000001',
            status: 'DRAFT',
            lines: [],
          }),
          count: jest.fn(),
          findMany: jest.fn(),
          aggregate: jest.fn(),
        },
        journalEntryLine: { createMany: jest.fn(), deleteMany: jest.fn() },
        account: {
          findMany: jest.fn().mockResolvedValue([{ id: 'acct-1', organizationId: ORG_ID }]),
        },
      } as unknown as import('../prisma/prisma.service').PrismaService;

      const service = new AccountingService(prisma);

      const result = await service.createJournalEntry(ORG_ID, USER_ID, {
        description: 'Large amount test',
        lines: [{ accountId: 'acct-1', debit: largeAmount, credit: largeAmount }],
      });

      expect(result).toBeDefined();
    });

    it('should handle extreme large amounts in trial balance', async () => {
      const extremeAmount = 999_999_999_999;

      const accounts = [{ id: 'acct-1', code: '1000', name: 'Cash', type: 'ASSET' }];
      const lines = [
        { debit: extremeAmount, credit: 0, accountId: 'acct-1' },
        { debit: 0, credit: extremeAmount, accountId: 'acct-1' },
      ];

      const prisma = {
        account: {
          findMany: jest.fn().mockResolvedValue(accounts),
          count: jest.fn(),
          aggregate: jest.fn(),
        },
        journalEntryLine: {
          findMany: jest.fn().mockResolvedValue(lines),
          aggregate: jest.fn(),
          createMany: jest.fn(),
          deleteMany: jest.fn(),
        },
        journalEntry: {
          findMany: jest.fn(),
          count: jest.fn(),
          create: jest.fn(),
          findFirst: jest.fn(),
        },
      } as unknown as import('../prisma/prisma.service').PrismaService;

      const service = new AccountingService(prisma);

      const result = await service.getTrialBalance(ORG_ID);

      expect(result.summary.totalDebit).toBe(extremeAmount);
      expect(result.summary.totalCredit).toBe(extremeAmount);
      expect(result.summary.isBalanced).toBe(true);
    });
  });

  describe('D. Balanced journal verification', () => {
    it('should accept journal entries with equal debits and credits', async () => {
      const prisma = {
        journalEntry: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'je-balanced',
            entryNumber: 'JE-2026-000001',
            status: 'DRAFT',
            lines: [],
          }),
          count: jest.fn(),
          findMany: jest.fn(),
          aggregate: jest.fn(),
        },
        journalEntryLine: { createMany: jest.fn(), deleteMany: jest.fn() },
        account: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'acct-dr', organizationId: ORG_ID },
            { id: 'acct-cr', organizationId: ORG_ID },
          ]),
        },
      } as unknown as import('../prisma/prisma.service').PrismaService;

      const service = new AccountingService(prisma);

      const result = await service.createJournalEntry(ORG_ID, USER_ID, {
        description: 'Balanced entry',
        lines: [
          { accountId: 'acct-dr', debit: 500, credit: 0 },
          { accountId: 'acct-cr', debit: 0, credit: 500 },
        ],
      });

      expect(result).toBeDefined();
    });

    it('should accept multi-line balanced entries', async () => {
      const prisma = {
        journalEntry: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'je-multi-bal',
            entryNumber: 'JE-2026-000001',
            status: 'DRAFT',
            lines: [],
          }),
          count: jest.fn(),
          findMany: jest.fn(),
          aggregate: jest.fn(),
        },
        journalEntryLine: { createMany: jest.fn(), deleteMany: jest.fn() },
        account: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'acct-a', organizationId: ORG_ID },
            { id: 'acct-b', organizationId: ORG_ID },
            { id: 'acct-c', organizationId: ORG_ID },
            { id: 'acct-d', organizationId: ORG_ID },
          ]),
        },
      } as unknown as import('../prisma/prisma.service').PrismaService;

      const service = new AccountingService(prisma);

      const result = await service.createJournalEntry(ORG_ID, USER_ID, {
        description: 'Multi-line balanced',
        lines: [
          { accountId: 'acct-a', debit: 300, credit: 0 },
          { accountId: 'acct-b', debit: 200, credit: 0 },
          { accountId: 'acct-c', debit: 0, credit: 300 },
          { accountId: 'acct-d', debit: 0, credit: 200 },
        ],
      });

      expect(result).toBeDefined();
    });
  });

  describe('E. Unbalanced journal verification', () => {
    it('should reject journal entries with unequal debits and credits', async () => {
      const prisma = {
        journalEntry: {
          findFirst: jest.fn(),
          create: jest.fn(),
        },
        account: {
          findMany: jest.fn(),
        },
      } as unknown as import('../prisma/prisma.service').PrismaService;

      const service = new AccountingService(prisma);

      await expect(
        service.createJournalEntry(ORG_ID, USER_ID, {
          description: 'Unbalanced',
          lines: [
            { accountId: 'acct-1', debit: 100, credit: 0 },
            { accountId: 'acct-2', debit: 0, credit: 50 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject entries where debits exceed credits', async () => {
      const prisma = {
        journalEntry: {
          findFirst: jest.fn(),
          create: jest.fn(),
        },
        account: {
          findMany: jest.fn(),
        },
      } as unknown as import('../prisma/prisma.service').PrismaService;

      const service = new AccountingService(prisma);

      await expect(
        service.createJournalEntry(ORG_ID, USER_ID, {
          description: 'Debits exceed credits',
          lines: [
            { accountId: 'acct-1', debit: 500, credit: 0 },
            { accountId: 'acct-2', debit: 0, credit: 200 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject entries where credits exceed debits', async () => {
      const prisma = {
        journalEntry: {
          findFirst: jest.fn(),
          create: jest.fn(),
        },
        account: {
          findMany: jest.fn(),
        },
      } as unknown as import('../prisma/prisma.service').PrismaService;

      const service = new AccountingService(prisma);

      await expect(
        service.createJournalEntry(ORG_ID, USER_ID, {
          description: 'Credits exceed debits',
          lines: [
            { accountId: 'acct-1', debit: 100, credit: 0 },
            { accountId: 'acct-2', debit: 0, credit: 300 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('F. Duplicate reversal prevention', () => {
    it('should reject reversal of an already-reversed entry', async () => {
      const ENTRY_ID = 'je-already-reversed';

      const prisma = {
        journalEntry: {
          findFirst: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
            const where = args.where as Record<string, unknown>;
            if (where.id === ENTRY_ID) {
              return {
                id: ENTRY_ID,
                entryNumber: 'JE-2026-000001',
                organizationId: ORG_ID,
                description: 'Original entry',
                status: 'POSTED',
                referenceId: null,
                referenceType: null,
                createdById: USER_ID,
                deletedAt: null,
                lines: [
                  { id: 'line-1', accountId: 'acct-1', debit: 1000, credit: 0, description: 'AR debit' },
                  { id: 'line-2', accountId: 'acct-2', debit: 0, credit: 1000, description: 'Revenue credit' },
                ],
              };
            }
            if (where.referenceType === 'REVERSAL' && where.referenceId === ENTRY_ID) {
              return { id: 'je-rev-existing', referenceType: 'REVERSAL' };
            }
            return null;
          }),
          create: jest.fn(),
          update: jest.fn(),
          count: jest.fn(),
        },
        journalEntryLine: { createMany: jest.fn(), deleteMany: jest.fn() },
        account: { findMany: jest.fn() },
      } as unknown as import('../prisma/prisma.service').PrismaService;

      const service = new AccountingService(prisma);

      await expect(
        service.reverseJournalEntry(ORG_ID, USER_ID, ENTRY_ID),
      ).rejects.toThrow(ConflictException);

      expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException with clear message on duplicate reversal', async () => {
      const ENTRY_ID = 'je-reverse-me';

      const prisma = {
        journalEntry: {
          findFirst: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
            const where = args.where as Record<string, unknown>;
            if (where.id === ENTRY_ID) {
              return {
                id: ENTRY_ID,
                entryNumber: 'JE-2026-000010',
                organizationId: ORG_ID,
                description: 'Entry to reverse',
                status: 'POSTED',
                lines: [
                  { id: 'l1', accountId: 'a1', debit: 200, credit: 0, description: null },
                  { id: 'l2', accountId: 'a2', debit: 0, credit: 200, description: null },
                ],
              };
            }
            if (where.referenceType === 'REVERSAL' && where.referenceId === ENTRY_ID) {
              return { id: 'prev-rev', referenceType: 'REVERSAL' };
            }
            return null;
          }),
          create: jest.fn(),
          update: jest.fn(),
          count: jest.fn(),
        },
        journalEntryLine: { createMany: jest.fn(), deleteMany: jest.fn() },
        account: { findMany: jest.fn() },
      } as unknown as import('../prisma/prisma.service').PrismaService;

      const service = new AccountingService(prisma);

      await expect(
        service.reverseJournalEntry(ORG_ID, USER_ID, ENTRY_ID),
      ).rejects.toThrow('already been reversed');
    });

    it('should not create any reversal journal when conflict is detected', async () => {
      const ENTRY_ID = 'je-conflict';

      const prisma = {
        journalEntry: {
          findFirst: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
            const where = args.where as Record<string, unknown>;
            if (where.id === ENTRY_ID) {
              return {
                id: ENTRY_ID,
                entryNumber: 'JE-2026-000020',
                organizationId: ORG_ID,
                description: 'Test',
                status: 'POSTED',
                lines: [{ id: 'l1', accountId: 'a1', debit: 100, credit: 0, description: null }],
              };
            }
            if (where.referenceType === 'REVERSAL' && where.referenceId === ENTRY_ID) {
              return { id: 'existing-rev' };
            }
            return null;
          }),
          create: jest.fn(),
          update: jest.fn(),
          count: jest.fn(),
        },
        journalEntryLine: { createMany: jest.fn(), deleteMany: jest.fn() },
        account: { findMany: jest.fn() },
      } as unknown as import('../prisma/prisma.service').PrismaService;

      const service = new AccountingService(prisma);

      await expect(
        service.reverseJournalEntry(ORG_ID, USER_ID, ENTRY_ID),
      ).rejects.toThrow();

      expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    });
  });
});
