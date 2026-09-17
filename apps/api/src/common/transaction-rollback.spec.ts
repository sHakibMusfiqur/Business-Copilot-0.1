import { Prisma, PaymentType } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

import { AccountingService } from '../accounting/accounting.service';

const ORG_ID = 'org-1';
const USER_ID = 'user-1';

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('mock error', { code, clientVersion: '0.0.0' });
}

describe('Transaction rollback tests', () => {
  describe('A. Journal creation rollback', () => {
    it('should rollback journal entry on transaction failure', async () => {
      const prisma = {
        journalEntry: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockImplementation(async () => {
            throw prismaError('P2002');
          }),
          count: jest.fn(),
          findMany: jest.fn(),
          aggregate: jest.fn(),
        },
        journalEntryLine: {
          createMany: jest.fn(),
          deleteMany: jest.fn(),
        },
        account: {
          findMany: jest.fn().mockResolvedValue([{ id: 'acct-1', organizationId: ORG_ID }]),
        },
      } as unknown as import('../prisma/prisma.service').PrismaService;

      const service = new AccountingService(prisma);

      await expect(
        service.createJournalEntry(ORG_ID, USER_ID, {
          description: 'Test rollback',
          lines: [{ accountId: 'acct-1', debit: 100, credit: 100 }],
        }),
      ).rejects.toThrow();

      expect(prisma.journalEntryLine.createMany).not.toHaveBeenCalled();
    });

    it('should not create journal entry lines when account validation fails', async () => {
      const prisma = {
        journalEntry: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn(),
          count: jest.fn(),
          findMany: jest.fn(),
          aggregate: jest.fn(),
        },
        journalEntryLine: {
          createMany: jest.fn(),
          deleteMany: jest.fn(),
        },
        account: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      } as unknown as import('../prisma/prisma.service').PrismaService;

      const service = new AccountingService(prisma);

      await expect(
        service.createJournalEntry(ORG_ID, USER_ID, {
          description: 'Invalid account',
          lines: [{ accountId: 'acct-nonexistent', debit: 100, credit: 100 }],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.journalEntry.create).not.toHaveBeenCalled();
      expect(prisma.journalEntryLine.createMany).not.toHaveBeenCalled();
    });

    it('should not create lines when unbalanced entry is submitted', async () => {
      const prisma = {
        journalEntry: {
          findFirst: jest.fn(),
          create: jest.fn(),
          count: jest.fn(),
          findMany: jest.fn(),
          aggregate: jest.fn(),
        },
        journalEntryLine: {
          createMany: jest.fn(),
          deleteMany: jest.fn(),
        },
        account: {
          findMany: jest.fn(),
        },
      } as unknown as import('../prisma/prisma.service').PrismaService;

      const service = new AccountingService(prisma);

      await expect(
        service.createJournalEntry(ORG_ID, USER_ID, {
          description: 'Unbalanced rollback test',
          lines: [
            { accountId: 'acct-1', debit: 100, credit: 0 },
            { accountId: 'acct-2', debit: 0, credit: 50 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.journalEntry.findFirst).not.toHaveBeenCalled();
      expect(prisma.journalEntry.create).not.toHaveBeenCalled();
      expect(prisma.journalEntryLine.createMany).not.toHaveBeenCalled();
    });
  });

  describe('B. Payment allocation rollback', () => {
    interface TxMock {
      $queryRaw: jest.Mock;
      customer: { findFirst: jest.Mock };
      supplier: { findFirst: jest.Mock };
      payment: { create: jest.Mock; findUnique: jest.Mock };
      receivable: { findFirst: jest.Mock; update: jest.Mock };
      payable: { findFirst: jest.Mock; update: jest.Mock };
      paymentAllocation: { create: jest.Mock };
      journalEntry: { findFirst: jest.Mock; create: jest.Mock };
      account: { findFirst: jest.Mock };
      invoice: { updateMany: jest.Mock };
    }

    it('should not create payment record when receivable validation fails', async () => {
      const tx: TxMock = {
        $queryRaw: jest.fn().mockResolvedValue([1]),
        customer: { findFirst: jest.fn().mockResolvedValue({ id: 'cust-1' }) },
        supplier: { findFirst: jest.fn().mockResolvedValue({ id: 'sup-1' }) },
        payment: {
          create: jest.fn(),
          findUnique: jest.fn(),
        },
        receivable: {
          findFirst: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
        payable: {
          findFirst: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
        paymentAllocation: { create: jest.fn() },
        journalEntry: {
          findFirst: jest.fn(),
          create: jest.fn(),
        },
        account: { findFirst: jest.fn() },
        invoice: { updateMany: jest.fn() },
      };

      const prisma = {
        $transaction: jest.fn().mockImplementation(
          (callback: (client: unknown) => unknown) => callback(tx),
        ),
      } as unknown as import('../prisma/prisma.service').PrismaService;

      const service = new AccountingService(prisma);

      await expect(
        service.createPayment(ORG_ID, USER_ID, {
          type: PaymentType.CUSTOMER_PAYMENT,
          customerId: 'cust-1',
          amount: 20,
          receivableId: 'rec-nonexistent',
        }),
      ).rejects.toThrow();

      expect(tx.payment.create).not.toHaveBeenCalled();
      expect(tx.paymentAllocation.create).not.toHaveBeenCalled();
      expect(tx.journalEntry.create).not.toHaveBeenCalled();
    });

    it('should not allocate when payment amount exceeds remaining balance', async () => {
      const tx: TxMock = {
        $queryRaw: jest.fn().mockResolvedValue([1]),
        customer: { findFirst: jest.fn().mockResolvedValue({ id: 'cust-1' }) },
        supplier: { findFirst: jest.fn().mockResolvedValue({ id: 'sup-1' }) },
        payment: {
          create: jest.fn(),
          findUnique: jest.fn(),
        },
        receivable: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'rec-1',
            organizationId: ORG_ID,
            totalAmount: 100,
            paidAmount: 90,
            status: 'PARTIALLY_PAID',
          }),
          update: jest.fn(),
        },
        payable: {
          findFirst: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
        paymentAllocation: { create: jest.fn() },
        journalEntry: {
          findFirst: jest.fn(),
          create: jest.fn(),
        },
        account: { findFirst: jest.fn() },
        invoice: { updateMany: jest.fn() },
      };

      const prisma = {
        $transaction: jest.fn().mockImplementation(
          (callback: (client: unknown) => unknown) => callback(tx),
        ),
      } as unknown as import('../prisma/prisma.service').PrismaService;

      const service = new AccountingService(prisma);

      await expect(
        service.createPayment(ORG_ID, USER_ID, {
          type: PaymentType.CUSTOMER_PAYMENT,
          customerId: 'cust-1',
          amount: 20,
          receivableId: 'rec-1',
        }),
      ).rejects.toThrow();

      expect(tx.paymentAllocation.create).not.toHaveBeenCalled();
      expect(tx.receivable.update).not.toHaveBeenCalled();
      expect(tx.journalEntry.create).not.toHaveBeenCalled();
    });
  });

  describe('C. Sales delivery rollback', () => {
    it('should not create revenue journal when sales order not found', async () => {
      const prisma = {
        journalEntry: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn(),
          count: jest.fn(),
        },
        account: {
          findFirst: jest.fn().mockResolvedValue({ id: 'acct-1' }),
          findMany: jest.fn().mockResolvedValue([]),
        },
        salesOrder: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      } as unknown as import('../prisma/prisma.service').PrismaService;

      const service = new AccountingService(prisma);

      await expect(
        service.createRevenueJournalEntry(ORG_ID, USER_ID, 'so-nonexistent'),
      ).rejects.toThrow();

      expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    });

    it('should not create COGS journal entry when sale has no items', async () => {
      const prisma = {
        journalEntry: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn(),
        },
        salesOrder: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'so-1',
            orderNumber: 'SO-001',
            total: 100,
          }),
        },
        salesOrderItem: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        product: {
          findMany: jest.fn(),
        },
        account: {
          findFirst: jest.fn(),
        },
        journalEntryLine: {
          createMany: jest.fn(),
        },
      } as unknown as import('../prisma/prisma.service').PrismaService;

      const service = new AccountingService(prisma);

      const result = await service.createCOGSJournalEntry(ORG_ID, USER_ID, 'so-1');

      expect(result).toBeNull();
      expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    });

    it('should not create new receivable when one already exists', async () => {
      const existingReceivable = {
        id: 'rec-existing',
        invoiceNumber: 'INV-SO-001',
        totalAmount: 100,
        status: 'PENDING',
        dueDate: new Date(),
      };

      const prisma = {
        journalEntry: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn(),
        },
        receivable: {
          findFirst: jest.fn().mockResolvedValue(existingReceivable),
        },
        salesOrder: {
          findFirst: jest.fn(),
        },
        account: {
          findFirst: jest.fn(),
        },
      } as unknown as import('../prisma/prisma.service').PrismaService;

      const service = new AccountingService(prisma);

      const result = await service.createReceivableForSales(ORG_ID, 'so-1');

      expect(result).toEqual(existingReceivable);
      expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    });
  });
});
