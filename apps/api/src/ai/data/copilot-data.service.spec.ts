import { CopilotDataService } from './copilot-data.service';
import type { HasPermission } from './copilot-data.service';

const ORG_ID = 'org-test';

function hasPermission(...allowed: string[]): HasPermission {
  return (perm: string) => allowed.includes(perm);
}

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    invoice: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { total: 0 }, _count: { _all: 0 } }),
      ...((overrides.invoice as Record<string, unknown>) ?? {}),
    },
    salesOrder: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { total: 0 }, _count: { _all: 0 } }),
      count: jest.fn().mockResolvedValue(0),
      ...((overrides.salesOrder as Record<string, unknown>) ?? {}),
    },
    purchaseOrder: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { total: 0 }, _count: { _all: 0 } }),
      count: jest.fn().mockResolvedValue(0),
      ...((overrides.purchaseOrder as Record<string, unknown>) ?? {}),
    },
    product: { count: jest.fn().mockResolvedValue(0) },
    customer: { count: jest.fn().mockResolvedValue(0) },
    supplier: { count: jest.fn().mockResolvedValue(0) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
}

describe('CopilotDataService', () => {
  describe('finance intent permission gating', () => {
    const financeIntents = [
      { intent: 'revenue' as const, label: 'Revenue' },
      { intent: 'expenses' as const, label: 'Expenses' },
      { intent: 'receivables' as const, label: 'Receivables' },
      { intent: 'payables' as const, label: 'Payables' },
      { intent: 'trends' as const, label: 'Trends' },
      { intent: 'performance' as const, label: 'Performance' },
    ];

    it.each(financeIntents)('allows $label with accounting.accounts.read only', async ({ intent }) => {
      const prisma = makePrisma();
      const service = new CopilotDataService(prisma as never);
      const has = hasPermission('accounting.accounts.read');

      const result = await service.retrieve(intent, ORG_ID, has);
      expect(result.permitted).toBe(true);
    });

    it.each(financeIntents)('allows $label with accounting.read only', async ({ intent }) => {
      const prisma = makePrisma();
      const service = new CopilotDataService(prisma as never);
      const has = hasPermission('accounting.read');

      const result = await service.retrieve(intent, ORG_ID, has);
      expect(result.permitted).toBe(true);
    });

    it.each([
      { intent: 'revenue' as const, label: 'Revenue' },
      { intent: 'receivables' as const, label: 'Receivables' },
      { intent: 'trends' as const, label: 'Trends' },
      { intent: 'performance' as const, label: 'Performance' },
    ])('allows $label with invoices.read only', async ({ intent }) => {
      const prisma = makePrisma();
      const service = new CopilotDataService(prisma as never);
      const has = hasPermission('invoices.read');

      const result = await service.retrieve(intent, ORG_ID, has);
      expect(result.permitted).toBe(true);
    });

    it('allows expenses with purchase.read only', async () => {
      const prisma = makePrisma();
      const service = new CopilotDataService(prisma as never);
      const has = hasPermission('purchase.read');

      const result = await service.retrieve('expenses', ORG_ID, has);
      expect(result.permitted).toBe(true);
    });

    it('allows payables with purchase.read only', async () => {
      const prisma = makePrisma();
      const service = new CopilotDataService(prisma as never);
      const has = hasPermission('purchase.read');

      const result = await service.retrieve('payables', ORG_ID, has);
      expect(result.permitted).toBe(true);
    });

    it.each(financeIntents)('blocks $label when user lacks all finance permissions', async ({ intent }) => {
      const prisma = makePrisma();
      const service = new CopilotDataService(prisma as never);
      const has = hasPermission('inventory.read');

      const result = await service.retrieve(intent, ORG_ID, has);
      expect(result.permitted).toBe(false);
    });
  });

  describe('non-finance intent permission gating', () => {
    it('allows sales_summary with invoices.read', async () => {
      const prisma = makePrisma();
      const service = new CopilotDataService(prisma as never);
      const has = hasPermission('invoices.read');

      const result = await service.retrieve('sales_summary', ORG_ID, has);
      expect(result.permitted).toBe(true);
    });

    it('blocks sales_summary when user lacks sales/invoice permissions', async () => {
      const prisma = makePrisma();
      const service = new CopilotDataService(prisma as never);
      const has = hasPermission('inventory.read');

      const result = await service.retrieve('sales_summary', ORG_ID, has);
      expect(result.permitted).toBe(false);
    });

    it('allows inventory with inventory.read', async () => {
      const prisma = makePrisma();
      const service = new CopilotDataService(prisma as never);
      const has = hasPermission('inventory.read');

      const result = await service.retrieve('inventory', ORG_ID, has);
      expect(result.permitted).toBe(true);
    });

    it('allows customers with customers.read', async () => {
      const prisma = makePrisma();
      const service = new CopilotDataService(prisma as never);
      const has = hasPermission('customers.read');

      const result = await service.retrieve('customers', ORG_ID, has);
      expect(result.permitted).toBe(true);
    });
  });
});
