import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

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
  invoice: { updateMany: jest.Mock };
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
      invoice: { updateMany: jest.fn().mockResolvedValue(undefined) },
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
});

describe('AccountingService reverseJournalEntry', () => {
  let service: AccountingService;
  let journalEntryFindFirst: jest.Mock;
  let journalEntryCreate: jest.Mock;
  let journalEntryUpdate: jest.Mock;
  let journalEntryFindUnique: jest.Mock;
  let journalEntryCount: jest.Mock;
  let loggerLog: jest.Mock;

  const ENTRY_ID = 'je-orig-1';
  const OTHER_ORG = 'org-other';

  const makePostedEntry = (overrides: Record<string, unknown> = {}) => ({
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
      { id: 'line-1', accountId: 'acct-ar', debit: 1000, credit: 0, description: 'AR debit' },
      { id: 'line-2', accountId: 'acct-rev', debit: 0, credit: 1000, description: 'Revenue credit' },
    ],
    ...overrides,
  });

  beforeEach(() => {
    journalEntryFindFirst = jest.fn();
    journalEntryFindUnique = jest.fn();
    journalEntryCreate = jest.fn();
    journalEntryUpdate = jest.fn();
    journalEntryCount = jest.fn();
    loggerLog = jest.fn();

    const prisma = {
      journalEntry: {
        findFirst: journalEntryFindFirst,
        findUnique: journalEntryFindUnique,
        create: journalEntryCreate,
        update: journalEntryUpdate,
        count: journalEntryCount,
      },
    } as unknown as PrismaService;

    service = new AccountingService(prisma);
    (service as unknown as { logger: { log: jest.Mock } }).logger = { log: loggerLog } as never;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects reversal of a non-POSTED entry', async () => {
    journalEntryFindFirst.mockResolvedValueOnce({ ...makePostedEntry(), status: 'DRAFT' });

    await expect(
      service.reverseJournalEntry(ORG_ID, USER_ID, ENTRY_ID),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects reversal of a non-existent entry', async () => {
    journalEntryFindFirst.mockResolvedValueOnce(null);

    await expect(
      service.reverseJournalEntry(ORG_ID, USER_ID, 'je-missing'),
    ).rejects.toThrow(NotFoundException);
  });

  it('leaves the original entry unchanged after reversal', async () => {
    const original = makePostedEntry();
    journalEntryFindFirst
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce(null);
    journalEntryFindUnique.mockResolvedValue(null);
    journalEntryCreate.mockResolvedValue({
      id: 'je-rev-1',
      entryNumber: 'JE-2026-000002',
      status: 'POSTED',
      referenceType: 'REVERSAL',
      referenceId: ENTRY_ID,
    });

    await service.reverseJournalEntry(ORG_ID, USER_ID, ENTRY_ID);

    expect(journalEntryUpdate).not.toHaveBeenCalled();
    expect(original.status).toBe('POSTED');
  });

  it('swaps every debit to an equal credit and every credit to an equal debit', async () => {
    const original = makePostedEntry();
    journalEntryFindFirst
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce(null);
    journalEntryFindUnique.mockResolvedValue(null);
    journalEntryCreate.mockResolvedValue({ id: 'je-rev-1', entryNumber: 'JE-2026-000002' });

    await service.reverseJournalEntry(ORG_ID, USER_ID, ENTRY_ID);

    expect(journalEntryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lines: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({ accountId: 'acct-ar', debit: 0, credit: 1000 }),
              expect.objectContaining({ accountId: 'acct-rev', debit: 1000, credit: 0 }),
            ]),
          }),
        }),
      }),
    );
  });

  it('creates a balanced reversal (total debits = total credits)', async () => {
    const original = makePostedEntry({
      lines: [
        { id: 'l1', accountId: 'acct-a', debit: 300, credit: 0, description: null },
        { id: 'l2', accountId: 'acct-b', debit: 200, credit: 0, description: null },
        { id: 'l3', accountId: 'acct-c', debit: 0, credit: 300, description: null },
        { id: 'l4', accountId: 'acct-d', debit: 0, credit: 200, description: null },
      ],
    });
    journalEntryFindFirst
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce(null);
    journalEntryFindUnique.mockResolvedValue(null);
    journalEntryCreate.mockResolvedValue({ id: 'je-rev-1', entryNumber: 'JE-2026-000002' });

    await service.reverseJournalEntry(ORG_ID, USER_ID, ENTRY_ID);

    const createCall = journalEntryCreate.mock.calls[0][0];
    const lines = createCall.data.lines.create;
    const totalDebit = lines.reduce((s: number, l: { debit: number }) => s + l.debit, 0);
    const totalCredit = lines.reduce((s: number, l: { credit: number }) => s + l.credit, 0);
    expect(totalDebit).toBe(totalCredit);
  });

  it('denies cross-organization reversal', async () => {
    journalEntryFindFirst.mockResolvedValueOnce(null);

    await expect(
      service.reverseJournalEntry(OTHER_ORG, USER_ID, ENTRY_ID),
    ).rejects.toThrow(NotFoundException);
  });

  it('prevents the same entry from being reversed twice', async () => {
    const original = makePostedEntry();
    journalEntryFindFirst
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce({ id: 'je-rev-existing', referenceType: 'REVERSAL' });

    await expect(
      service.reverseJournalEntry(ORG_ID, USER_ID, ENTRY_ID),
    ).rejects.toThrow(ConflictException);

    expect(journalEntryCreate).not.toHaveBeenCalled();
  });

  it('identifies the reversal entry via referenceType=REVERSAL', async () => {
    const original = makePostedEntry();
    journalEntryFindFirst
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce(null);
    journalEntryFindUnique.mockResolvedValue(null);
    journalEntryCreate.mockResolvedValue({ id: 'je-rev-1', entryNumber: 'JE-2026-000002' });

    await service.reverseJournalEntry(ORG_ID, USER_ID, ENTRY_ID);

    expect(journalEntryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          referenceType: 'REVERSAL',
          referenceId: ENTRY_ID,
        }),
      }),
    );
  });

  it('records an audit log event', async () => {
    const original = makePostedEntry();
    journalEntryFindFirst
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce(null);
    journalEntryFindUnique.mockResolvedValue(null);
    journalEntryCreate.mockResolvedValue({
      id: 'je-rev-1',
      entryNumber: 'JE-2026-000002',
    });

    await service.reverseJournalEntry(ORG_ID, USER_ID, ENTRY_ID);

    expect(loggerLog).toHaveBeenCalledWith(
      expect.stringContaining('reversed'),
    );
  });
});

describe('AccountingService report consistency (sale / COGS / payment)', () => {
  let service: AccountingService;

  const accounts = [
    { id: 'acct-cash', code: '1000', name: 'Cash', type: 'ASSET' },
    { id: 'acct-ar', code: '1100', name: 'Accounts Receivable', type: 'ASSET' },
    { id: 'acct-inv', code: '1200', name: 'Inventory', type: 'ASSET' },
    { id: 'acct-rev', code: '4000', name: 'Revenue', type: 'REVENUE' },
    { id: 'acct-cogs', code: '5000', name: 'COGS', type: 'EXPENSE' },
  ];

  const postedLines = [
    { accountId: 'acct-ar', debit: 1000, credit: 0 },
    { accountId: 'acct-rev', debit: 0, credit: 1000 },
    { accountId: 'acct-cogs', debit: 400, credit: 0 },
    { accountId: 'acct-inv', debit: 0, credit: 400 },
    { accountId: 'acct-cash', debit: 1000, credit: 0 },
    { accountId: 'acct-ar', debit: 0, credit: 1000 },
  ];

  const buildPrismaMock = (overrides: Record<string, unknown> = {}) => {
    const accountFindMany = jest.fn().mockResolvedValue(
      overrides.accounts ?? accounts,
    );

    const journalEntryLineFindMany = jest.fn().mockImplementation(
      (args: { where: { accountId?: string }; include?: Record<string, unknown> }) => {
        const hasAccountInclude = !!args.include?.account;
        const aid = args.where?.accountId;
        const rawLines = aid
          ? postedLines.filter((l) => l.accountId === aid)
          : postedLines;
        if (hasAccountInclude) {
          return Promise.resolve(
            rawLines.map((l) => ({
              ...l,
              account: accounts.find((a) => a.id === l.accountId),
            })),
          );
        }
        return Promise.resolve(rawLines.map((l) => ({ debit: l.debit, credit: l.credit })));
      },
    );

    const journalEntryLineAggregate = jest.fn().mockImplementation(
      (args: { where: { account: { type?: string }; journalEntry: { status?: string } } }) => {
        const accountType = args.where?.account?.type;
        const filtered = postedLines.filter((l) => {
          const acct = accounts.find((a) => a.id === l.accountId);
          return acct?.type === accountType;
        });
        if (args.where?.account?.type === 'REVENUE') {
          const sumCredit = filtered.reduce((s, l) => s + l.credit, 0);
          return Promise.resolve({ _sum: { credit: sumCredit } });
        }
        if (args.where?.account?.type === 'EXPENSE') {
          const sumDebit = filtered.reduce((s, l) => s + l.debit, 0);
          return Promise.resolve({ _sum: { debit: sumDebit } });
        }
        return Promise.resolve({ _sum: { credit: 0, debit: 0 } });
      },
    );

    const journalEntryFindMany = jest.fn().mockImplementation(
      (_args: { where: Record<string, unknown>; include?: Record<string, unknown> }) => {
        const cashAccountId = 'acct-cash';
        const arAccountId = 'acct-ar';
        const revAccountId = 'acct-rev';
        const cogsAccountId = 'acct-cogs';
        const invAccountId = 'acct-inv';

        const entries = [
          {
            id: 'je-sale',
            entryNumber: 'JE-2026-000001',
            date: new Date('2026-01-15'),
            status: 'POSTED',
            description: 'Sale',
            lines: [
              { accountId: arAccountId, debit: 1000, credit: 0, account: accounts.find((a) => a.id === arAccountId) },
              { accountId: revAccountId, debit: 0, credit: 1000, account: accounts.find((a) => a.id === revAccountId) },
            ],
          },
          {
            id: 'je-cogs',
            entryNumber: 'JE-2026-000002',
            date: new Date('2026-01-15'),
            status: 'POSTED',
            description: 'COGS',
            lines: [
              { accountId: cogsAccountId, debit: 400, credit: 0, account: accounts.find((a) => a.id === cogsAccountId) },
              { accountId: invAccountId, debit: 0, credit: 400, account: accounts.find((a) => a.id === invAccountId) },
            ],
          },
          {
            id: 'je-pay',
            entryNumber: 'JE-2026-000003',
            date: new Date('2026-01-20'),
            status: 'POSTED',
            description: 'Payment',
            lines: [
              { accountId: cashAccountId, debit: 1000, credit: 0, account: accounts.find((a) => a.id === cashAccountId) },
              { accountId: arAccountId, debit: 0, credit: 1000, account: accounts.find((a) => a.id === arAccountId) },
            ],
          },
        ];

        return Promise.resolve(entries);
      },
    );

    return {
      account: { findMany: accountFindMany, count: jest.fn(), aggregate: jest.fn() },
      journalEntryLine: {
        findMany: journalEntryLineFindMany,
        aggregate: journalEntryLineAggregate,
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      journalEntry: {
        findMany: journalEntryFindMany,
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
      },
    } as unknown as PrismaService;
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('trial balance: total debits equal total credits', async () => {
    const prisma = buildPrismaMock();
    service = new AccountingService(prisma);

    const result = await service.getTrialBalance(ORG_ID);

    expect(result.summary.isBalanced).toBe(true);
    expect(result.summary.totalDebit).toBe(result.summary.totalCredit);
  });

  it('P&L: revenue=$1000, COGS=$400, gross profit=$600', async () => {
    const prisma = buildPrismaMock();
    service = new AccountingService(prisma);

    const result = await service.getProfitAndLoss(ORG_ID);

    expect(Number(result.revenue.total)).toBe(1000);
    expect(Number(result.costOfGoodsSold.total)).toBe(400);
    expect(Number(result.grossProfit)).toBe(600);
  });

  it('cash flow: operating inflow=$1000 from AR collection', async () => {
    const prisma = buildPrismaMock();
    service = new AccountingService(prisma);

    const result = await service.getCashFlow(ORG_ID);

    expect(Number(result.operating.inflow)).toBe(1000);
  });
});

describe('AccountingService date boundary tests (findAllJournalEntries)', () => {
  let service: AccountingService;
  let journalEntryFindMany: jest.Mock;
  let journalEntryCount: jest.Mock;
  let storedEntries: ReturnType<typeof makeEntry>[];

  const makeEntry = (date: Date, description: string) => ({
    id: `je-${description.replace(/\s+/g, '-').toLowerCase()}`,
    entryNumber: 'JE-2026-000001',
    date,
    description,
    status: 'POSTED',
    referenceId: null,
    referenceType: null,
    createdAt: date,
    createdBy: { id: USER_ID, name: 'Test User' },
    lines: [],
  });

  beforeEach(() => {
    storedEntries = [];

    journalEntryFindMany = jest.fn().mockImplementation(
      (args: { where: Record<string, unknown> }) => {
        let result = [...storedEntries];
        const dateFilter = args.where?.date as { gte?: Date; lte?: Date } | undefined;
        if (dateFilter) {
          if (dateFilter.gte) {
            const gte = dateFilter.gte;
            result = result.filter((e) => e.date >= gte);
          }
          if (dateFilter.lte) {
            const lte = dateFilter.lte;
            result = result.filter((e) => e.date <= lte);
          }
        }
        return Promise.resolve(result);
      },
    );
    journalEntryCount = jest.fn().mockImplementation(() => Promise.resolve(storedEntries.length));

    const prisma = {
      journalEntry: {
        findMany: journalEntryFindMany,
        count: journalEntryCount,
      },
    } as unknown as PrismaService;

    service = new AccountingService(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const setupEntries = (...entries: ReturnType<typeof makeEntry>[]) => {
    storedEntries = entries;
    return entries;
  };

  it('dateFrom is inclusive (transaction ON dateFrom IS included)', async () => {
    const target = new Date('2026-03-15T10:00:00.000Z');
    setupEntries(makeEntry(target, 'On boundary'));

    const result = await service.findAllJournalEntries(ORG_ID, {
      dateFrom: '2026-03-15T10:00:00.000Z',
    });

    expect(result.data.length).toBe(1);
    expect(result.data[0].description).toBe('On boundary');
  });

  it('dateTo is inclusive (transaction ON dateTo IS included)', async () => {
    const target = new Date('2026-03-15T10:00:00.000Z');
    setupEntries(makeEntry(target, 'On boundary'));

    const result = await service.findAllJournalEntries(ORG_ID, {
      dateTo: '2026-03-15T10:00:00.000Z',
    });

    expect(result.data.length).toBe(1);
    expect(result.data[0].description).toBe('On boundary');
  });

  it('transaction 1 second before dateFrom is excluded', async () => {
    const before = new Date('2026-03-15T09:59:59.000Z');
    const after = new Date('2026-03-15T10:00:01.000Z');
    setupEntries(makeEntry(before, 'Before'), makeEntry(after, 'After'));

    const result = await service.findAllJournalEntries(ORG_ID, {
      dateFrom: '2026-03-15T10:00:00.000Z',
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].description).toBe('After');
  });

  it('transaction 1 second after dateTo is excluded', async () => {
    const before = new Date('2026-03-15T09:59:59.000Z');
    const after = new Date('2026-03-15T10:00:01.000Z');
    setupEntries(makeEntry(before, 'Before'), makeEntry(after, 'After'));

    const result = await service.findAllJournalEntries(ORG_ID, {
      dateTo: '2026-03-15T10:00:00.000Z',
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].description).toBe('Before');
  });

  it('same-day transaction with dateFrom=dateTo is included', async () => {
    const day = '2026-06-01T12:00:00.000Z';
    const target = new Date(day);
    setupEntries(makeEntry(target, 'Same day'));

    const result = await service.findAllJournalEntries(ORG_ID, {
      dateFrom: day,
      dateTo: day,
    });

    expect(result.data.length).toBeGreaterThanOrEqual(1);
  });

  it('no dates returns all entries', async () => {
    const e1 = makeEntry(new Date('2026-01-01'), 'Jan');
    const e2 = makeEntry(new Date('2026-06-15'), 'Jun');
    const e3 = makeEntry(new Date('2026-12-31'), 'Dec');
    setupEntries(e1, e2, e3);

    const result = await service.findAllJournalEntries(ORG_ID, {});

    expect(result.data).toHaveLength(3);
  });
});

describe('AccountingService processPaymentAllocation concurrency guard', () => {
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
      payable: { findFirst: jest.fn().mockResolvedValue({ id: 'pay-1', organizationId: ORG_ID, totalAmount: 100, paidAmount: 40, status: 'PARTIALLY_PAID' }), update: jest.fn() },
      paymentAllocation: { create: jest.fn().mockResolvedValue(undefined) },
      journalEntry: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'je-1' }),
      },
      account: { findFirst: jest.fn().mockResolvedValue({ id: 'acct-1' }) },
      invoice: { updateMany: jest.fn().mockResolvedValue(undefined) },
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
    tx.receivable.findFirst.mockResolvedValue(receivable({ paidAmount: 55, status: 'PENDING' }));

    await service.createPayment(ORG_ID, USER_ID, makeDto({ amount: 20 }));

    expect(tx.receivable.update).toHaveBeenCalledWith({
      where: { id: 'rec-1' },
      data: expect.objectContaining({ paidAmount: 75 }),
    });
  });

  it('rejects a second allocation after a concurrent winner already consumed the balance', async () => {
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

describe('AccountingService D-B1: rejects payments without receivable/payable allocation', () => {
  let service: AccountingService;
  let tx: TxMock;

  const makeDto = (overrides: Record<string, unknown> = {}) => ({
    type: PaymentType.CUSTOMER_PAYMENT,
    customerId: 'cust-1',
    amount: 60,
    receivableId: 'rec-1',
    ...overrides,
  });

  const makeSupplierDto = (overrides: Record<string, unknown> = {}) => ({
    type: PaymentType.SUPPLIER_PAYMENT,
    supplierId: 'sup-1',
    amount: 60,
    payableId: 'pay-1',
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
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([1]),
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
      invoice: { updateMany: jest.fn().mockResolvedValue(undefined) },
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

describe('AccountingService getCashFlow', () => {
  let service: AccountingService;
  let journalEntryFindMany: jest.Mock;

  beforeEach(() => {
    journalEntryFindMany = jest.fn();

    const prisma = {
      journalEntry: {
        findMany: journalEntryFindMany,
      },
    } as unknown as PrismaService;

    service = new AccountingService(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const makeEntry = (
    lines: Array<{ debit: number; credit: number; account: { type: string; code: string; name: string } }>,
    opts?: { referenceType?: string },
  ) => ({
    id: 'je-1',
    status: 'POSTED',
    referenceType: opts?.referenceType ?? null,
    lines,
  });

  it('A: customer cash collection (Dr Cash / Cr AR) -> operating inflow $100', async () => {
    journalEntryFindMany.mockResolvedValue([
      makeEntry([
        { debit: 100, credit: 0, account: { type: 'ASSET', code: '1000', name: 'Cash' } },
        { debit: 0, credit: 100, account: { type: 'ASSET', code: '1100', name: 'Accounts Receivable' } },
      ]),
    ]);

    const result = await service.getCashFlow(ORG_ID);

    expect(result.operating.inflow.toNumber()).toBe(100);
    expect(result.operating.outflow.toNumber()).toBe(0);
  });

  it('B: supplier payment (Dr AP / Cr Cash) -> operating outflow $50', async () => {
    journalEntryFindMany.mockResolvedValue([
      makeEntry([
        { debit: 50, credit: 0, account: { type: 'LIABILITY', code: '2000', name: 'Accounts Payable' } },
        { debit: 0, credit: 50, account: { type: 'ASSET', code: '1000', name: 'Cash' } },
      ]),
    ]);

    const result = await service.getCashFlow(ORG_ID);

    expect(result.operating.outflow.toNumber()).toBe(50);
    expect(result.operating.inflow.toNumber()).toBe(0);
  });

  it('C: operating expense payment (Dr Expense / Cr Cash) -> operating outflow $30', async () => {
    journalEntryFindMany.mockResolvedValue([
      makeEntry([
        { debit: 30, credit: 0, account: { type: 'EXPENSE', code: '6000', name: 'Rent Expense' } },
        { debit: 0, credit: 30, account: { type: 'ASSET', code: '1000', name: 'Cash' } },
      ]),
    ]);

    const result = await service.getCashFlow(ORG_ID);

    expect(result.operating.outflow.toNumber()).toBe(30);
    expect(result.operating.inflow.toNumber()).toBe(0);
  });

  it('D: inventory purchase (Dr Inventory / Cr Cash) -> investing outflow $200, counted once', async () => {
    journalEntryFindMany.mockResolvedValue([
      makeEntry([
        { debit: 200, credit: 0, account: { type: 'ASSET', code: '1200', name: 'Inventory' } },
        { debit: 0, credit: 200, account: { type: 'ASSET', code: '1000', name: 'Cash' } },
      ]),
    ]);

    const result = await service.getCashFlow(ORG_ID);

    expect(result.investing.outflow.toNumber()).toBe(200);
    expect(result.operating.outflow.toNumber()).toBe(0);
    expect(result.operating.inflow.toNumber()).toBe(0);
  });

  it('E: non-cash journal entry (Dr Expense / Cr AP) -> no cash flow impact', async () => {
    journalEntryFindMany.mockResolvedValue([
      makeEntry([
        { debit: 40, credit: 0, account: { type: 'EXPENSE', code: '6000', name: 'Utilities Expense' } },
        { debit: 0, credit: 40, account: { type: 'LIABILITY', code: '2000', name: 'Accounts Payable' } },
      ]),
    ]);

    const result = await service.getCashFlow(ORG_ID);

    expect(result.operating.inflow.toNumber()).toBe(0);
    expect(result.operating.outflow.toNumber()).toBe(0);
    expect(result.investing.inflow.toNumber()).toBe(0);
    expect(result.investing.outflow.toNumber()).toBe(0);
  });

  it('F: payroll payment (Dr Salaries Payable 2100 / Cr Cash with PAYROLL_PAYMENT refType) -> operating outflow $800', async () => {
    journalEntryFindMany.mockResolvedValue([
      makeEntry([
        { debit: 800, credit: 0, account: { type: 'LIABILITY', code: '2100', name: 'Salaries Payable' } },
        { debit: 0, credit: 800, account: { type: 'ASSET', code: '1000', name: 'Cash' } },
      ], { referenceType: 'PAYROLL_PAYMENT' }),
    ]);

    const result = await service.getCashFlow(ORG_ID);

    expect(result.operating.outflow.toNumber()).toBe(800);
    expect(result.operating.inflow.toNumber()).toBe(0);
    expect(result.financing.outflow.toNumber()).toBe(0);
  });

  it('F2: 2100 liability without referenceType defaults to operating outflow', async () => {
    journalEntryFindMany.mockResolvedValue([
      makeEntry([
        { debit: 300, credit: 0, account: { type: 'LIABILITY', code: '2100', name: 'Accrued Liabilities' } },
        { debit: 0, credit: 300, account: { type: 'ASSET', code: '1000', name: 'Cash' } },
      ]),
    ]);

    const result = await service.getCashFlow(ORG_ID);

    expect(result.operating.outflow.toNumber()).toBe(300);
    expect(result.financing.outflow.toNumber()).toBe(0);
  });

  it('F3: payroll approval accrual (Dr Expense / Cr Salaries Payable) -> no cash flow (non-cash entry)', async () => {
    journalEntryFindMany.mockResolvedValue([
      makeEntry([
        { debit: 1000, credit: 0, account: { type: 'EXPENSE', code: '6000', name: 'Salary Expense' } },
        { debit: 0, credit: 1000, account: { type: 'LIABILITY', code: '2100', name: 'Salaries Payable' } },
      ], { referenceType: 'PAYROLL_APPROVAL' }),
    ]);

    const result = await service.getCashFlow(ORG_ID);

    expect(result.operating.inflow.toNumber()).toBe(0);
    expect(result.operating.outflow.toNumber()).toBe(0);
  });

  it('G0: cross-org isolation -> only org A entries are counted', async () => {
    journalEntryFindMany.mockResolvedValue([
      makeEntry([
        { debit: 100, credit: 0, account: { type: 'ASSET', code: '1000', name: 'Cash' } },
        { debit: 0, credit: 100, account: { type: 'REVENUE', code: '4000', name: 'Sales Revenue' } },
      ]),
    ]);

    await service.getCashFlow('org-A');

    expect(journalEntryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-A' }),
      }),
    );
  });

  it('G: loan proceeds (Dr Cash / Cr Loan Payable with LOAN_PROCEEDS refType) -> financing inflow $1000', async () => {
    journalEntryFindMany.mockResolvedValue([
      makeEntry([
        { debit: 1000, credit: 0, account: { type: 'ASSET', code: '1000', name: 'Cash' } },
        { debit: 0, credit: 1000, account: { type: 'LIABILITY', code: '2200', name: 'Loan Payable' } },
      ], { referenceType: 'LOAN_PROCEEDS' }),
    ]);

    const result = await service.getCashFlow(ORG_ID);

    expect(result.financing.inflow.toNumber()).toBe(1000);
    expect(result.financing.outflow.toNumber()).toBe(0);
    expect(result.operating.inflow.toNumber()).toBe(0);
    expect(result.operating.outflow.toNumber()).toBe(0);
  });

  it('H: loan repayment (Dr Loan Payable / Cr Cash with LOAN_REPAYMENT refType) -> financing outflow $500', async () => {
    journalEntryFindMany.mockResolvedValue([
      makeEntry([
        { debit: 500, credit: 0, account: { type: 'LIABILITY', code: '2200', name: 'Loan Payable' } },
        { debit: 0, credit: 500, account: { type: 'ASSET', code: '1000', name: 'Cash' } },
      ], { referenceType: 'LOAN_REPAYMENT' }),
    ]);

    const result = await service.getCashFlow(ORG_ID);

    expect(result.financing.outflow.toNumber()).toBe(500);
    expect(result.financing.inflow.toNumber()).toBe(0);
    expect(result.operating.outflow.toNumber()).toBe(0);
  });

  it('I: equity contribution (Dr Cash / Cr Equity) -> financing inflow $2000', async () => {
    journalEntryFindMany.mockResolvedValue([
      makeEntry([
        { debit: 2000, credit: 0, account: { type: 'ASSET', code: '1000', name: 'Cash' } },
        { debit: 0, credit: 2000, account: { type: 'EQUITY', code: '3000', name: 'Owner Equity' } },
      ]),
    ]);

    const result = await service.getCashFlow(ORG_ID);

    expect(result.financing.inflow.toNumber()).toBe(2000);
    expect(result.financing.outflow.toNumber()).toBe(0);
    expect(result.operating.inflow.toNumber()).toBe(0);
  });

  it('J: owner withdrawal (Dr Equity / Cr Cash) -> financing outflow $300', async () => {
    journalEntryFindMany.mockResolvedValue([
      makeEntry([
        { debit: 300, credit: 0, account: { type: 'EQUITY', code: '3000', name: 'Owner Equity' } },
        { debit: 0, credit: 300, account: { type: 'ASSET', code: '1000', name: 'Cash' } },
      ]),
    ]);

    const result = await service.getCashFlow(ORG_ID);

    expect(result.financing.outflow.toNumber()).toBe(300);
    expect(result.financing.inflow.toNumber()).toBe(0);
    expect(result.operating.outflow.toNumber()).toBe(0);
  });

  it('K: mixed activities -> each classified correctly, no double counting', async () => {
    journalEntryFindMany.mockResolvedValue([
      makeEntry([
        { debit: 500, credit: 0, account: { type: 'ASSET', code: '1000', name: 'Cash' } },
        { debit: 0, credit: 500, account: { type: 'REVENUE', code: '4000', name: 'Sales Revenue' } },
      ]),
      makeEntry([
        { debit: 200, credit: 0, account: { type: 'LIABILITY', code: '2200', name: 'Loan Payable' } },
        { debit: 0, credit: 200, account: { type: 'ASSET', code: '1000', name: 'Cash' } },
      ], { referenceType: 'LOAN_REPAYMENT' }),
      makeEntry([
        { debit: 100, credit: 0, account: { type: 'EXPENSE', code: '6000', name: 'Rent Expense' } },
        { debit: 0, credit: 100, account: { type: 'ASSET', code: '1000', name: 'Cash' } },
      ]),
    ]);

    const result = await service.getCashFlow(ORG_ID);

    expect(result.operating.inflow.toNumber()).toBe(500);
    expect(result.operating.outflow.toNumber()).toBe(100);
    expect(result.financing.outflow.toNumber()).toBe(200);
    expect(result.financing.inflow.toNumber()).toBe(0);
    expect(result.netCashFlow.toNumber()).toBe(200);
  });

  it('L: AP payment (Dr 2000 / Cr Cash, no referenceType) classified via classifyLiability() as operating', async () => {
    journalEntryFindMany.mockResolvedValue([
      makeEntry([
        { debit: 50, credit: 0, account: { type: 'LIABILITY', code: '2000', name: 'Accounts Payable' } },
        { debit: 0, credit: 50, account: { type: 'ASSET', code: '1000', name: 'Cash' } },
      ]),
    ]);

    const result = await service.getCashFlow(ORG_ID);

    expect(result.operating.outflow.toNumber()).toBe(50);
    expect(result.financing.outflow.toNumber()).toBe(0);
  });

  it('L2: loan repayment using code 2100 with LOAN_REPAYMENT refType -> financing outflow', async () => {
    journalEntryFindMany.mockResolvedValue([
      makeEntry([
        { debit: 500, credit: 0, account: { type: 'LIABILITY', code: '2100', name: 'Loan Payable' } },
        { debit: 0, credit: 500, account: { type: 'ASSET', code: '1000', name: 'Cash' } },
      ], { referenceType: 'LOAN_REPAYMENT' }),
    ]);

    const result = await service.getCashFlow(ORG_ID);

    expect(result.financing.outflow.toNumber()).toBe(500);
    expect(result.operating.outflow.toNumber()).toBe(0);
  });

  it('L3: loan proceeds using code 2100 with LOAN_PROCEEDS refType -> financing inflow', async () => {
    journalEntryFindMany.mockResolvedValue([
      makeEntry([
        { debit: 1000, credit: 0, account: { type: 'ASSET', code: '1000', name: 'Cash' } },
        { debit: 0, credit: 1000, account: { type: 'LIABILITY', code: '2100', name: 'Loan Payable' } },
      ], { referenceType: 'LOAN_PROCEEDS' }),
    ]);

    const result = await service.getCashFlow(ORG_ID);

    expect(result.financing.inflow.toNumber()).toBe(1000);
    expect(result.operating.inflow.toNumber()).toBe(0);
  });

  it('M: deletedAt filter excludes soft-deleted journal entries', async () => {
    journalEntryFindMany.mockResolvedValue([]);

    await service.getCashFlow(ORG_ID);

    expect(journalEntryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });
});

describe('AccountingService getProfitAndLoss P&L classification', () => {
  let service: AccountingService;
  let journalEntryLineFindMany: jest.Mock;

  beforeEach(() => {
    journalEntryLineFindMany = jest.fn();

    const prisma = {
      journalEntryLine: {
        findMany: journalEntryLineFindMany,
      },
    } as unknown as PrismaService;

    service = new AccountingService(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('classifies REVENUE account type into revenue section', async () => {
    journalEntryLineFindMany.mockResolvedValue([
      {
        debit: 0,
        credit: 5000,
        accountId: 'acct-rev-1',
        account: { type: 'REVENUE', code: '4000', name: 'Sales Revenue' },
      },
    ]);

    const result = await service.getProfitAndLoss(ORG_ID);

    expect(result.revenue.total.toNumber()).toBe(5000);
    expect(result.costOfGoodsSold.total.toNumber()).toBe(0);
  });

  it('classifies EXPENSE with code starting with 5 as COGS', async () => {
    journalEntryLineFindMany.mockResolvedValue([
      {
        debit: 300,
        credit: 0,
        accountId: 'acct-cogs-1',
        account: { type: 'EXPENSE', code: '5000', name: 'Cost of Goods Sold' },
      },
    ]);

    const result = await service.getProfitAndLoss(ORG_ID);

    expect(result.costOfGoodsSold.total.toNumber()).toBe(300);
    expect(result.grossProfit.toNumber()).toBe(-300);
  });

  it('classifies EXPENSE with code 6xxx/7xxx as operating expense', async () => {
    journalEntryLineFindMany.mockResolvedValue([
      {
        debit: 200,
        credit: 0,
        accountId: 'acct-exp-1',
        account: { type: 'EXPENSE', code: '6100', name: 'Salary Expense' },
      },
      {
        debit: 100,
        credit: 0,
        accountId: 'acct-exp-2',
        account: { type: 'EXPENSE', code: '7200', name: 'Depreciation Expense' },
      },
    ]);

    const result = await service.getProfitAndLoss(ORG_ID);

    expect(result.operatingExpenses.total.toNumber()).toBe(300);
    expect(result.costOfGoodsSold.total.toNumber()).toBe(0);
  });

  it('computes gross profit = revenue - COGS and net profit = revenue - total expenses', async () => {
    journalEntryLineFindMany.mockResolvedValue([
      {
        debit: 0,
        credit: 10000,
        accountId: 'acct-rev-1',
        account: { type: 'REVENUE', code: '4000', name: 'Sales Revenue' },
      },
      {
        debit: 4000,
        credit: 0,
        accountId: 'acct-cogs-1',
        account: { type: 'EXPENSE', code: '5000', name: 'COGS' },
      },
      {
        debit: 1000,
        credit: 0,
        accountId: 'acct-exp-1',
        account: { type: 'EXPENSE', code: '6100', name: 'Rent Expense' },
      },
    ]);

    const result = await service.getProfitAndLoss(ORG_ID);

    expect(result.revenue.total.toNumber()).toBe(10000);
    expect(result.costOfGoodsSold.total.toNumber()).toBe(4000);
    expect(result.grossProfit.toNumber()).toBe(6000);
    expect(result.totalExpenses.toNumber()).toBe(5000);
    expect(result.netProfit.toNumber()).toBe(5000);
    expect(result.operatingExpenses.total.toNumber()).toBe(1000);
  });

  it('excludes soft-deleted journal entries via deletedAt filter', async () => {
    journalEntryLineFindMany.mockResolvedValue([]);

    await service.getProfitAndLoss(ORG_ID);

    expect(journalEntryLineFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          journalEntry: expect.objectContaining({ deletedAt: null }),
        }),
      }),
    );
  });
});

describe('AccountingService updateReceivableOverdueStatuses', () => {
  let service: AccountingService;
  let receivableUpdateMany: jest.Mock;

  beforeEach(() => {
    receivableUpdateMany = jest.fn();

    const prisma = {
      receivable: {
        updateMany: receivableUpdateMany,
      },
    } as unknown as PrismaService;

    service = new AccountingService(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('transitions overdue receivables from PENDING to OVERDUE', async () => {
    receivableUpdateMany.mockResolvedValue({ count: 3 });

    const count = await service.updateReceivableOverdueStatuses(ORG_ID);

    expect(count).toBe(3);
    expect(receivableUpdateMany).toHaveBeenCalledWith({
      where: {
        organizationId: ORG_ID,
        dueDate: { lt: expect.any(Date) },
        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
      },
      data: { status: 'OVERDUE' },
    });
  });

  it('returns 0 when no receivables are overdue', async () => {
    receivableUpdateMany.mockResolvedValue({ count: 0 });

    const count = await service.updateReceivableOverdueStatuses(ORG_ID);

    expect(count).toBe(0);
  });

  it('does not transition PAID or CANCELLED receivables', async () => {
    receivableUpdateMany.mockResolvedValue({ count: 0 });

    await service.updateReceivableOverdueStatuses(ORG_ID);

    expect(receivableUpdateMany).toHaveBeenCalledWith({
      where: {
        organizationId: ORG_ID,
        dueDate: { lt: expect.any(Date) },
        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
      },
      data: { status: 'OVERDUE' },
    });
  });

  it('is idempotent - repeated calls produce same result', async () => {
    receivableUpdateMany.mockResolvedValue({ count: 2 });

    const count1 = await service.updateReceivableOverdueStatuses(ORG_ID);
    const count2 = await service.updateReceivableOverdueStatuses(ORG_ID);

    expect(count1).toBe(2);
    expect(count2).toBe(2);
    expect(receivableUpdateMany).toHaveBeenCalledTimes(2);
  });

  it('isolates by organization - only updates org-scoped receivables', async () => {
    receivableUpdateMany.mockResolvedValue({ count: 1 });

    await service.updateReceivableOverdueStatuses('org-A');

    expect(receivableUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-A' }),
      }),
    );
  });
});