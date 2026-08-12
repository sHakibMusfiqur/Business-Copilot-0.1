import { BadRequestException, NotFoundException } from '@nestjs/common';

import { PaymentType } from '@prisma/client';

import { AccountingService } from './accounting.service';
import { PrismaService } from '../prisma/prisma.service';

const ORG_ID = 'org-1';
const USER_ID = 'user-1';

describe('AccountingService journal-entry numbering (tenant isolation)', () => {
  let service: AccountingService;
  let journalEntryFindFirst: jest.Mock;
  let journalEntryCreate: jest.Mock;
  let journalEntryLineCreate: jest.Mock;
  let accountFindMany: jest.Mock;

  beforeEach(() => {
    journalEntryFindFirst = jest.fn();
    journalEntryCreate = jest.fn();
    journalEntryLineCreate = jest.fn();
    accountFindMany = jest.fn();

    const prisma = {
      journalEntry: {
        findFirst: journalEntryFindFirst,
        create: journalEntryCreate,
        count: jest.fn(),
        findMany: jest.fn(),
        aggregate: jest.fn(),
        update: jest.fn(),
      },
      journalEntryLine: { createMany: jest.fn(), deleteMany: jest.fn() },
      account: {
        findFirst: jest.fn(),
        findMany: accountFindMany,
        count: jest.fn(),
        aggregate: jest.fn(),
      },
    } as unknown as PrismaService;

    service = new AccountingService(prisma);

    // No prior entries -> the generator returns the first sequence number.
    journalEntryFindFirst.mockResolvedValue(null);
    accountFindMany.mockResolvedValue([{ id: 'acct-1', organizationId: ORG_ID }]);
    journalEntryCreate.mockImplementation(async ({ data }) => {
      if (data?.lines?.create) {
        await journalEntryLineCreate(data.lines.create);
      }
      return { id: 'je-1', entryNumber: data.entryNumber, status: 'DRAFT' };
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const entryNumberPrefix = (suffix: string) => expect.stringMatching(new RegExp(`^JE-\\d{4}-${suffix}$`));

  it('includes organizationId in the journal-entry number lookup', async () => {
    await service.createJournalEntry(ORG_ID, USER_ID, {
      description: 'Test entry',
      lines: [{ accountId: 'acct-1', debit: 100, credit: 100 }],
    });

    expect(journalEntryFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: ORG_ID,
          entryNumber: { startsWith: expect.stringMatching(/^JE-\d{4}-$/) },
        }),
      }),
    );
  });

  it('preserves existing numbering behavior (first entry gets suffix 000001)', async () => {
    journalEntryFindFirst.mockResolvedValue(null);

    await service.createJournalEntry(ORG_ID, USER_ID, {
      description: 'Test entry',
      lines: [{ accountId: 'acct-1', debit: 100, credit: 100 }],
    });

    expect(journalEntryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entryNumber: entryNumberPrefix('000001'),
        }),
      }),
    );
  });

  it('increments from the highest existing same-prefix entry number', async () => {
    journalEntryFindFirst.mockResolvedValue({ entryNumber: 'JE-2026-000042' });

    await service.createJournalEntry(ORG_ID, USER_ID, {
      description: 'Test entry',
      lines: [{ accountId: 'acct-1', debit: 100, credit: 100 }],
    });

    expect(journalEntryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entryNumber: entryNumberPrefix('000043'),
        }),
      }),
    );
  });

  it('rejects an unbalanced journal entry before any lookup', async () => {
    await expect(
      service.createJournalEntry(ORG_ID, USER_ID, {
        description: 'Unbalanced',
        lines: [{ accountId: 'acct-1', debit: 100, credit: 50 }],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(journalEntryFindFirst).not.toHaveBeenCalled();
    expect(journalEntryCreate).not.toHaveBeenCalled();
  });
});

describe('AccountingService updateAccount parentId (tenant isolation)', () => {
  let service: AccountingService;
  let accountFindFirst: jest.Mock;
  let accountUpdate: jest.Mock;

  beforeEach(() => {
    accountFindFirst = jest.fn();
    accountUpdate = jest.fn();

    const prisma = {
      account: { findFirst: accountFindFirst, update: accountUpdate },
    } as unknown as PrismaService;

    service = new AccountingService(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('throws NotFound when the account does not belong to the organization', async () => {
    accountFindFirst.mockResolvedValue(null);

    await expect(
      service.updateAccount(ORG_ID, 'acct-1', { name: 'New' }),
    ).rejects.toThrow(NotFoundException);
    expect(accountUpdate).not.toHaveBeenCalled();
  });

  it('rejects setting parentId to an account from another organization', async () => {
    accountFindFirst
      .mockResolvedValueOnce({ id: 'acct-1', organizationId: ORG_ID }) // current account exists
      .mockResolvedValueOnce(null); // parent not in this org

    await expect(
      service.updateAccount(ORG_ID, 'acct-1', { parentId: 'acct-other-org' }),
    ).rejects.toThrow(NotFoundException);
    expect(accountFindFirst).toHaveBeenLastCalledWith({
      where: { id: 'acct-other-org', organizationId: ORG_ID },
    });
    expect(accountUpdate).not.toHaveBeenCalled();
  });

  it('allows setting parentId to an account in the same organization', async () => {
    accountFindFirst
      .mockResolvedValueOnce({ id: 'acct-1', organizationId: ORG_ID }) // current account
      .mockResolvedValueOnce({ id: 'acct-parent', organizationId: ORG_ID }); // parent exists
    accountUpdate.mockResolvedValue({ id: 'acct-1', parentId: 'acct-parent' });

    const result = await service.updateAccount(ORG_ID, 'acct-1', { parentId: 'acct-parent' });

    expect(accountFindFirst).toHaveBeenLastCalledWith({
      where: { id: 'acct-parent', organizationId: ORG_ID },
    });
    expect(accountUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parentId: 'acct-parent' }),
      }),
    );
    expect(result).toBeDefined();
  });

  it('rejects setting itself as parent', async () => {
    accountFindFirst.mockResolvedValue({ id: 'acct-1', organizationId: ORG_ID });

    await expect(
      service.updateAccount(ORG_ID, 'acct-1', { parentId: 'acct-1' }),
    ).rejects.toThrow(BadRequestException);
    expect(accountUpdate).not.toHaveBeenCalled();
  });
});

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
}

describe('AccountingService processPaymentAllocation (P3-H1 / P3-H2)', () => {
  let service: AccountingService;
  let tx: TxMock;
  let queryRaw: jest.Mock;

  const makeDto = (overrides: Record<string, unknown> = {}) => ({
    type: PaymentType.CUSTOMER_PAYMENT,
    customerId: 'cust-1',
    amount: 60,
    receivableId: 'rec-1',
    ...overrides,
  });

  const receivable = (overrides: Record<string, unknown> = {}) => ({
    id: 'rec-1',
    organizationId: ORG_ID,
    totalAmount: 100,
    paidAmount: 40,
    status: 'PARTIALLY_PAID',
    ...overrides,
  });

  const payable = (overrides: Record<string, unknown> = {}) => ({
    id: 'pay-1',
    organizationId: ORG_ID,
    totalAmount: 100,
    paidAmount: 40,
    status: 'PARTIALLY_PAID',
    ...overrides,
  });

  beforeEach(() => {
    queryRaw = jest.fn().mockResolvedValue([1]);

    tx = {
      $queryRaw: queryRaw,
      customer: { findFirst: jest.fn().mockResolvedValue({ id: 'cust-1' }) },
      supplier: { findFirst: jest.fn().mockResolvedValue({ id: 'sup-1' }) },
      payment: {
        create: jest.fn().mockImplementation(async () => ({ id: 'p-1' })),
        findUnique: jest.fn().mockResolvedValue({ reference: 'REF' }),
      },
      receivable: { findFirst: jest.fn().mockResolvedValue(receivable()), update: jest.fn() },
      payable: { findFirst: jest.fn().mockResolvedValue(payable()), update: jest.fn() },
      paymentAllocation: { create: jest.fn().mockResolvedValue(undefined) },
      journalEntry: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'je-1' }),
      },
      account: { findFirst: jest.fn().mockResolvedValue({ id: 'acct-1' }) },
    };

    const prisma = {
      $transaction: jest.fn().mockImplementation(
        (callback: (client: unknown) => unknown) => callback(tx),
      ),
    } as unknown as PrismaService;

    service = new AccountingService(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── P3-H1 : Receivable ────────────────────────────────────────

  describe('receivable allocation guards', () => {
    it('accepts a partial payment within the outstanding balance', async () => {
      tx.receivable.findFirst.mockResolvedValue(receivable({ paidAmount: 40, status: 'PENDING' }));

      await service.createPayment(ORG_ID, USER_ID, makeDto({ amount: 20 }));

      expect(tx.paymentAllocation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ receivableId: 'rec-1', amount: 20 }),
      });
      expect(tx.receivable.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: { paidAmount: 60, status: 'PARTIALLY_PAID' },
      });
    });

    it('accepts an exact remaining-balance payment and marks the receivable PAID', async () => {
      tx.receivable.findFirst.mockResolvedValue(receivable({ paidAmount: 40, status: 'PENDING' }));

      await service.createPayment(ORG_ID, USER_ID, makeDto({ amount: 60 }));

      expect(tx.receivable.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: { paidAmount: 100, status: 'PAID' },
      });
    });

    it('rejects an amount greater than the remaining balance', async () => {
      tx.receivable.findFirst.mockResolvedValue(receivable({ paidAmount: 40, status: 'PENDING' }));

      await expect(
        service.createPayment(ORG_ID, USER_ID, makeDto({ amount: 61 })),
      ).rejects.toThrow(BadRequestException);

      expect(tx.paymentAllocation.create).not.toHaveBeenCalled();
      expect(tx.receivable.update).not.toHaveBeenCalled();
      expect(tx.journalEntry.create).not.toHaveBeenCalled();
    });

    it('rejects a payment against a PAID receivable', async () => {
      tx.receivable.findFirst.mockResolvedValue(receivable({ status: 'PAID' }));

      await expect(
        service.createPayment(ORG_ID, USER_ID, makeDto({ amount: 10 })),
      ).rejects.toThrow(BadRequestException);

      expect(tx.paymentAllocation.create).not.toHaveBeenCalled();
      expect(tx.receivable.update).not.toHaveBeenCalled();
    });

    it('rejects a payment against a CANCELLED receivable', async () => {
      tx.receivable.findFirst.mockResolvedValue(receivable({ status: 'CANCELLED' }));

      await expect(
        service.createPayment(ORG_ID, USER_ID, makeDto({ amount: 10 })),
      ).rejects.toThrow(BadRequestException);

      expect(tx.paymentAllocation.create).not.toHaveBeenCalled();
      expect(tx.receivable.update).not.toHaveBeenCalled();
    });
  });

  // ─── P3-H1 : Payable ───────────────────────────────────────────

  describe('payable allocation guards', () => {
    const makeSupplierDto = (overrides: Record<string, unknown> = {}) => ({
      type: PaymentType.SUPPLIER_PAYMENT,
      supplierId: 'sup-1',
      amount: 60,
      payableId: 'pay-1',
      ...overrides,
    });

    it('accepts a partial payment within the outstanding balance', async () => {
      tx.payable.findFirst.mockResolvedValue(payable({ paidAmount: 40, status: 'PENDING' }));

      await service.createPayment(ORG_ID, USER_ID, makeSupplierDto({ amount: 20 }));

      expect(tx.paymentAllocation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ payableId: 'pay-1', amount: 20 }),
      });
      expect(tx.payable.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: { paidAmount: 60, status: 'PARTIALLY_PAID' },
      });
    });

    it('accepts an exact remaining-balance payment and marks the payable PAID', async () => {
      tx.payable.findFirst.mockResolvedValue(payable({ paidAmount: 40, status: 'PENDING' }));

      await service.createPayment(ORG_ID, USER_ID, makeSupplierDto({ amount: 60 }));

      expect(tx.payable.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: { paidAmount: 100, status: 'PAID' },
      });
    });

    it('rejects an amount greater than the remaining balance', async () => {
      tx.payable.findFirst.mockResolvedValue(payable({ paidAmount: 40, status: 'PENDING' }));

      await expect(
        service.createPayment(ORG_ID, USER_ID, makeSupplierDto({ amount: 61 })),
      ).rejects.toThrow(BadRequestException);

      expect(tx.paymentAllocation.create).not.toHaveBeenCalled();
      expect(tx.payable.update).not.toHaveBeenCalled();
    });

    it('rejects a payment against a PAID payable', async () => {
      tx.payable.findFirst.mockResolvedValue(payable({ status: 'PAID' }));

      await expect(
        service.createPayment(ORG_ID, USER_ID, makeSupplierDto({ amount: 10 })),
      ).rejects.toThrow(BadRequestException);

      expect(tx.paymentAllocation.create).not.toHaveBeenCalled();
      expect(tx.payable.update).not.toHaveBeenCalled();
    });

    it('rejects a payment against a CANCELLED payable', async () => {
      tx.payable.findFirst.mockResolvedValue(payable({ status: 'CANCELLED' }));

      await expect(
        service.createPayment(ORG_ID, USER_ID, makeSupplierDto({ amount: 10 })),
      ).rejects.toThrow(BadRequestException);

      expect(tx.paymentAllocation.create).not.toHaveBeenCalled();
      expect(tx.payable.update).not.toHaveBeenCalled();
    });
  });

  // ─── P3-H2 : concurrency / locking ─────────────────────────────

  describe('concurrency guard', () => {
    it('issues a SELECT ... FOR UPDATE row lock on the target receivable before allocation', async () => {
      await service.createPayment(ORG_ID, USER_ID, makeDto({ amount: 20 }));

      expect(queryRaw).toHaveBeenCalledTimes(1);
      const sql: TemplateStringsArray = queryRaw.mock.calls[0][0];
      const params = queryRaw.mock.calls[0].slice(1);
      expect(sql.join('')).toContain('SELECT id FROM "Receivable"');
      expect(sql.join('')).toContain('FOR UPDATE');
      expect(sql.join('')).toContain('"organizationId"');
      expect(params).toContain('rec-1');
      expect(params).toContain(ORG_ID);
    });

    it('reads the authoritative paidAmount from the locked row before computing the new balance', async () => {
      // The DB row is authoritative (paidAmount=55); the client-supplied amount
      // only contributes the increment, so the new balance is 55 + 20 = 75.
      tx.receivable.findFirst.mockResolvedValue(receivable({ paidAmount: 55, status: 'PENDING' }));

      await service.createPayment(ORG_ID, USER_ID, makeDto({ amount: 20 }));

      expect(tx.receivable.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: expect.objectContaining({ paidAmount: 75 }),
      });
    });

    it('rejects a second allocation after a concurrent winner already consumed the balance', async () => {
      // Simulate the loser: winner committed first, so the locked row now shows
      // paidAmount=60 (remaining=40). A second 60 amount must be rejected.
      tx.receivable.findFirst.mockResolvedValue(receivable({ paidAmount: 60, status: 'PARTIALLY_PAID' }));

      await expect(
        service.createPayment(ORG_ID, USER_ID, makeDto({ amount: 60 })),
      ).rejects.toThrow(BadRequestException);

      expect(tx.paymentAllocation.create).not.toHaveBeenCalled();
      expect(tx.receivable.update).not.toHaveBeenCalled();
      expect(tx.journalEntry.create).not.toHaveBeenCalled();
    });

    it('leaves no accounting artifacts when the loser allocation is rejected', async () => {
      tx.receivable.findFirst.mockResolvedValue(receivable({ paidAmount: 80, status: 'PARTIALLY_PAID' }));

      await expect(
        service.createPayment(ORG_ID, USER_ID, makeDto({ amount: 100 })),
      ).rejects.toThrow(BadRequestException);

      expect(tx.paymentAllocation.create).not.toHaveBeenCalled();
      expect(tx.receivable.update).not.toHaveBeenCalled();
      expect(tx.journalEntry.create).not.toHaveBeenCalled();
    });

    it('creates exactly one payment/allocation/journal set for a winning allocation', async () => {
      tx.receivable.findFirst.mockResolvedValue(receivable({ paidAmount: 40, status: 'PENDING' }));

      const result = await service.createPayment(ORG_ID, USER_ID, makeDto({ amount: 60 }));

      expect(result).toBeDefined();
      expect(tx.receivable.update).toHaveBeenCalledTimes(1);
      expect(tx.paymentAllocation.create).toHaveBeenCalledTimes(1);
      expect(tx.journalEntry.create).toHaveBeenCalledTimes(1);
    });
  });

  // ─── D-B1: orphan payment prevention ─────────────────────────

  describe('D-B1: rejects payments without receivable/payable allocation', () => {
    const makeSupplierDto = (overrides: Record<string, unknown> = {}) => ({
      type: PaymentType.SUPPLIER_PAYMENT,
      supplierId: 'sup-1',
      amount: 60,
      payableId: 'pay-1',
      ...overrides,
    });

    it('rejects a customer payment without receivableId', async () => {
      await expect(
        service.createPayment(ORG_ID, USER_ID, makeDto({ receivableId: undefined })),
      ).rejects.toThrow('receivableId is required for customer payments');
    });

    it('rejects a supplier payment without payableId', async () => {
      await expect(
        service.createPayment(ORG_ID, USER_ID, makeSupplierDto({ payableId: undefined })),
      ).rejects.toThrow('payableId is required for supplier payments');
    });

    it('accepts a valid customer payment with receivableId (unchanged behavior)', async () => {
      tx.receivable.findFirst.mockResolvedValue(receivable({ paidAmount: 40, status: 'PENDING' }));

      const result = await service.createPayment(ORG_ID, USER_ID, makeDto({ amount: 20 }));

      expect(result).toBeDefined();
      expect(tx.paymentAllocation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ receivableId: 'rec-1', amount: 20 }),
      });
    });

    it('accepts a valid supplier payment with payableId (unchanged behavior)', async () => {
      tx.payable.findFirst.mockResolvedValue(payable({ paidAmount: 40, status: 'PENDING' }));

      const result = await service.createPayment(ORG_ID, USER_ID, makeSupplierDto({ amount: 20 }));

      expect(result).toBeDefined();
      expect(tx.paymentAllocation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ payableId: 'pay-1', amount: 20 }),
      });
    });

    it('rejects a cross-organization receivable', async () => {
      tx.receivable.findFirst.mockResolvedValue(null);

      await expect(
        service.createPayment(ORG_ID, USER_ID, makeDto({ receivableId: 'rec-other-org', amount: 20 })),
      ).rejects.toThrow('Receivable not found');
    });

    it('rejects a cross-organization payable', async () => {
      tx.payable.findFirst.mockResolvedValue(null);

      await expect(
        service.createPayment(ORG_ID, USER_ID, makeSupplierDto({ payableId: 'pay-other-org', amount: 20 })),
      ).rejects.toThrow('Payable not found');
    });

    it('preserves existing allocation and remaining-balance validation', async () => {
      tx.receivable.findFirst.mockResolvedValue(receivable({ paidAmount: 90, status: 'PARTIALLY_PAID' }));

      await expect(
        service.createPayment(ORG_ID, USER_ID, makeDto({ amount: 20 })),
      ).rejects.toThrow('Payment amount exceeds the remaining balance');
    });
  });
});