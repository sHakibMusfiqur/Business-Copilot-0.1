import { BadRequestException, NotFoundException } from '@nestjs/common';

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