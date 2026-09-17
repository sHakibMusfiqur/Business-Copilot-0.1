import { AccountingService } from '../accounting/accounting.service';

const ORG_ID = 'org-1';

function buildPaginatedPrisma(overrides: {
  accounts?: Array<Record<string, unknown>>;
  total?: number;
} = {}) {
  const accounts = overrides.accounts ?? [
    { id: 'a1', code: '1000', name: 'Cash', type: 'ASSET', parentId: null, description: null, isActive: true, createdAt: new Date(), parent: null },
    { id: 'a2', code: '1100', name: 'AR', type: 'ASSET', parentId: null, description: null, isActive: true, createdAt: new Date(), parent: null },
  ];
  const total = overrides.total ?? accounts.length;

  const findMany = jest.fn().mockImplementation((args: Record<string, unknown>) => {
    const skip = (args.skip as number) ?? 0;
    const take = (args.take as number);
    if (take !== undefined && take <= 0) {
      return Promise.resolve([]);
    }
    return Promise.resolve(accounts.slice(skip, skip + (take ?? 10)));
  });

  const count = jest.fn().mockResolvedValue(total);

  return {
    account: {
      findMany,
      count,
      aggregate: jest.fn(),
    },
    journalEntry: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      findFirst: jest.fn(),
      aggregate: jest.fn(),
    },
    journalEntryLine: {
      findMany: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
}

describe('Pagination edge cases', () => {
  describe('A. Page 1 with default limit', () => {
    it('should return first page of results with default limit', async () => {
      const accounts = Array.from({ length: 5 }, (_, i) => ({
        id: `a${i + 1}`,
        code: `${1000 + i}`,
        name: `Account ${i + 1}`,
        type: 'ASSET',
        parentId: null,
        description: null,
        isActive: true,
        createdAt: new Date(),
        parent: null,
      }));

      const prisma = buildPaginatedPrisma({ accounts, total: 5 });
      const service = new AccountingService(prisma as never);

      const result = await service.findAllAccounts(ORG_ID, {});

      expect(result.data.length).toBe(5);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(50);
      expect(result.meta.total).toBe(5);
    });

    it('should respect explicit page and limit', async () => {
      const accounts = Array.from({ length: 30 }, (_, i) => ({
        id: `a${i + 1}`,
        code: `${1000 + i}`,
        name: `Account ${i + 1}`,
        type: 'ASSET',
        parentId: null,
        description: null,
        isActive: true,
        createdAt: new Date(),
        parent: null,
      }));

      const prisma = buildPaginatedPrisma({ accounts, total: 30 });
      const service = new AccountingService(prisma as never);

      const result = await service.findAllAccounts(ORG_ID, { page: 1, limit: 10 });

      expect(result.data.length).toBe(10);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(3);
    });
  });

  describe('B. Page beyond last page', () => {
    it('should return empty array when page exceeds total pages', async () => {
      const accounts = Array.from({ length: 5 }, (_, i) => ({
        id: `a${i + 1}`,
        code: `${1000 + i}`,
        name: `Account ${i + 1}`,
        type: 'ASSET',
        parentId: null,
        description: null,
        isActive: true,
        createdAt: new Date(),
        parent: null,
      }));

      const prisma = buildPaginatedPrisma({ accounts, total: 5 });
      const service = new AccountingService(prisma as never);

      const result = await service.findAllAccounts(ORG_ID, { page: 100, limit: 10 });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(5);
      expect(result.meta.page).toBe(100);
    });

    it('should return last page when page equals total pages', async () => {
      const accounts = Array.from({ length: 25 }, (_, i) => ({
        id: `a${i + 1}`,
        code: `${1000 + i}`,
        name: `Account ${i + 1}`,
        type: 'ASSET',
        parentId: null,
        description: null,
        isActive: true,
        createdAt: new Date(),
        parent: null,
      }));

      const prisma = buildPaginatedPrisma({ accounts, total: 25 });
      const service = new AccountingService(prisma as never);

      const result = await service.findAllAccounts(ORG_ID, { page: 3, limit: 10 });

      expect(result.data.length).toBe(5);
      expect(result.meta.totalPages).toBe(3);
    });
  });

  describe('C. Invalid limit (0 or negative)', () => {
    it('should not crash when limit is 0 and returns zero results', async () => {
      const accounts = Array.from({ length: 60 }, (_, i) => ({
        id: `a${i + 1}`,
        code: `${1000 + i}`,
        name: `Account ${i + 1}`,
        type: 'ASSET',
        parentId: null,
        description: null,
        isActive: true,
        createdAt: new Date(),
        parent: null,
      }));

      const prisma = buildPaginatedPrisma({ accounts, total: 60 });
      const service = new AccountingService(prisma as never);

      const result = await service.findAllAccounts(ORG_ID, { limit: 0 });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(60);
    });

    it('should not crash when limit is negative', async () => {
      const accounts = Array.from({ length: 60 }, (_, i) => ({
        id: `a${i + 1}`,
        code: `${1000 + i}`,
        name: `Account ${i + 1}`,
        type: 'ASSET',
        parentId: null,
        description: null,
        isActive: true,
        createdAt: new Date(),
        parent: null,
      }));

      const prisma = buildPaginatedPrisma({ accounts, total: 60 });
      const service = new AccountingService(prisma as never);

      const result = await service.findAllAccounts(ORG_ID, { limit: -5 });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(60);
    });

    it('should not crash when page is 0 and returns zero results', async () => {
      const accounts = Array.from({ length: 60 }, (_, i) => ({
        id: `a${i + 1}`,
        code: `${1000 + i}`,
        name: `Account ${i + 1}`,
        type: 'ASSET',
        parentId: null,
        description: null,
        isActive: true,
        createdAt: new Date(),
        parent: null,
      }));

      const prisma = buildPaginatedPrisma({ accounts, total: 60 });
      const service = new AccountingService(prisma as never);

      const result = await service.findAllAccounts(ORG_ID, { page: 0 });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(60);
    });
  });

  describe('D. Empty result set', () => {
    it('should return empty array with total 0 when no records match', async () => {
      const prisma = buildPaginatedPrisma({ accounts: [], total: 0 });
      const service = new AccountingService(prisma as never);

      const result = await service.findAllAccounts(ORG_ID, {});

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('should return empty array with total 0 when search yields no results', async () => {
      const prisma = {
        account: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
          aggregate: jest.fn(),
        },
        journalEntry: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
          create: jest.fn(),
          findFirst: jest.fn(),
          aggregate: jest.fn(),
        },
        journalEntryLine: {
          findMany: jest.fn().mockResolvedValue([]),
          aggregate: jest.fn(),
          createMany: jest.fn(),
          deleteMany: jest.fn(),
        },
      };
      const service = new AccountingService(prisma as never);

      const result = await service.findAllAccounts(ORG_ID, { search: 'nonexistent-xyz-999' });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('E. Search with special characters', () => {
    it('should handle search with regex special characters without crashing', async () => {
      const prisma = {
        account: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
          aggregate: jest.fn(),
        },
        journalEntry: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
          create: jest.fn(),
          findFirst: jest.fn(),
          aggregate: jest.fn(),
        },
        journalEntryLine: {
          findMany: jest.fn().mockResolvedValue([]),
          aggregate: jest.fn(),
          createMany: jest.fn(),
          deleteMany: jest.fn(),
        },
      };
      const service = new AccountingService(prisma as never);

      const specialSearches = [
        "Robert'); DROP TABLE Students;--",
        '<script>alert("xss")</script>',
        '%_%',
        '\\',
        '["quotes"]',
        '{json: "payload"}',
        'café résumé',
      ];

      for (const search of specialSearches) {
        const result = await service.findAllAccounts(ORG_ID, { search });
        expect(result.data).toEqual([]);
        expect(result.meta.total).toBe(0);
      }
    });

    it('should trim whitespace from search terms', async () => {
      const prisma = {
        account: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
          aggregate: jest.fn(),
        },
        journalEntry: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
          create: jest.fn(),
          findFirst: jest.fn(),
          aggregate: jest.fn(),
        },
        journalEntryLine: {
          findMany: jest.fn().mockResolvedValue([]),
          aggregate: jest.fn(),
          createMany: jest.fn(),
          deleteMany: jest.fn(),
        },
      };
      const service = new AccountingService(prisma as never);

      await service.findAllAccounts(ORG_ID, { search: '  Cash  ' });

      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                name: expect.objectContaining({ contains: 'Cash' }),
              }),
            ]),
          }),
        }),
      );
    });

    it('should not crash on empty string search', async () => {
      const prisma = {
        account: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
          aggregate: jest.fn(),
        },
        journalEntry: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
          create: jest.fn(),
          findFirst: jest.fn(),
          aggregate: jest.fn(),
        },
        journalEntryLine: {
          findMany: jest.fn().mockResolvedValue([]),
          aggregate: jest.fn(),
          createMany: jest.fn(),
          deleteMany: jest.fn(),
        },
      };
      const service = new AccountingService(prisma as never);

      const result = await service.findAllAccounts(ORG_ID, { search: '' });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });
});
