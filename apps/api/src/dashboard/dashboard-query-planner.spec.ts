import { describe, expect, it } from 'vitest';

import {
  buildQueryPlan,
  getUnknownSources,
  getValidSourceKeys,
  getAllQueryGroups,
  getDedupGroup,
  SALES_DEDUP_GROUP,
} from './dashboard-query-planner';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALL_PERMISSIONS = [
  'sales.read', 'invoices.read', 'payments.read', 'accounting.read', 'reports.finance',
  'inventory.read', 'customers.read', 'suppliers.read', 'purchase.read',
  'employees.read', 'payroll.read', 'audit.read',
];

const SALES_ONLY = ['sales.read', 'invoices.read'];
const SALES_ONLY_NO_INVOICES = ['sales.read'];
const INVENTORY_ONLY = ['inventory.read'];
const FINANCE_ONLY = ['invoices.read', 'payments.read', 'accounting.read', 'reports.finance'];
const EMPLOYEE_ONLY = ['employees.read', 'payroll.read'];
const AUDIT_ONLY = ['audit.read'];
const NO_PERMISSIONS: string[] = [];

// ─── buildQueryPlan ───────────────────────────────────────────────────────────

describe('buildQueryPlan', () => {
  describe('single source groups', () => {
    it('enables sales group for todaySales source', () => {
      const plan = buildQueryPlan(['todaySales'], SALES_ONLY);
      expect(plan.sales).toBe(true);
      expect(plan.inventory).toBe(false);
      expect(plan.customers).toBe(false);
      expect(plan.employees).toBe(false);
      expect(plan.leaves).toBe(false);
      expect(plan.payroll).toBe(false);
      expect(plan.finance).toBe(false);
      expect(plan.audit).toBe(false);
      expect(plan.activeGroupCount).toBe(1);
    });

    it('enables inventory group for lowStock source', () => {
      const plan = buildQueryPlan(['lowStock'], INVENTORY_ONLY);
      expect(plan.inventory).toBe(true);
      expect(plan.sales).toBe(false);
      expect(plan.activeGroupCount).toBe(1);
    });

    it('enables customers group for totalCustomers source', () => {
      const plan = buildQueryPlan(['totalCustomers'], ['customers.read']);
      expect(plan.customers).toBe(true);
      expect(plan.activeGroupCount).toBe(1);
    });

    it('enables employees group for totalEmployees source', () => {
      const plan = buildQueryPlan(['totalEmployees'], EMPLOYEE_ONLY);
      expect(plan.employees).toBe(true);
      expect(plan.activeGroupCount).toBe(1);
    });

    it('enables leaves group for pendingLeaves source', () => {
      const plan = buildQueryPlan(['pendingLeaves'], EMPLOYEE_ONLY);
      expect(plan.leaves).toBe(true);
      expect(plan.activeGroupCount).toBe(1);
    });

    it('enables payroll group for monthlyPayroll source', () => {
      const plan = buildQueryPlan(['monthlyPayroll'], EMPLOYEE_ONLY);
      expect(plan.payroll).toBe(true);
      expect(plan.activeGroupCount).toBe(1);
    });

    it('enables finance group for monthlyRevenue source', () => {
      const plan = buildQueryPlan(['monthlyRevenue'], FINANCE_ONLY);
      expect(plan.finance).toBe(true);
      expect(plan.activeGroupCount).toBe(1);
    });

    it('enables audit group for activity source', () => {
      const plan = buildQueryPlan(['activity'], AUDIT_ONLY);
      expect(plan.audit).toBe(true);
      expect(plan.activeGroupCount).toBe(1);
    });
  });

  describe('multiple sources in same group', () => {
    it('enables sales group once for multiple sales sources', () => {
      const plan = buildQueryPlan(
        ['todaySales', 'todayOrders', 'todayRevenue', 'pendingOrders', 'completedOrders', 'cancelledOrders'],
        SALES_ONLY,
      );
      expect(plan.sales).toBe(true);
      expect(plan.activeGroupCount).toBe(1);
      expect(plan.activeSourcesByGroup.sales).toEqual(
        expect.arrayContaining(['todaySales', 'todayOrders', 'todayRevenue', 'pendingOrders', 'completedOrders', 'cancelledOrders']),
      );
    });

    it('enables inventory group for both inventory sources', () => {
      const plan = buildQueryPlan(['lowStock', 'inventoryValue'], INVENTORY_ONLY);
      expect(plan.inventory).toBe(true);
      expect(plan.activeGroupCount).toBe(1);
      expect(plan.activeSourcesByGroup.inventory).toEqual(
        expect.arrayContaining(['lowStock', 'inventoryValue']),
      );
    });
  });

  describe('multiple groups', () => {
    it('enables sales + inventory for mixed sources', () => {
      const plan = buildQueryPlan(['todaySales', 'lowStock'], ALL_PERMISSIONS);
      expect(plan.sales).toBe(true);
      expect(plan.inventory).toBe(true);
      expect(plan.activeGroupCount).toBe(2);
    });

    it('enables all 8 groups when all sources are present', () => {
      const plan = buildQueryPlan([
        'todaySales', 'lowStock', 'totalCustomers', 'totalEmployees',
        'pendingLeaves', 'monthlyPayroll', 'monthlyRevenue', 'activity',
      ], ALL_PERMISSIONS);
      expect(plan.activeGroupCount).toBe(8);
      expect(plan.sales).toBe(true);
      expect(plan.inventory).toBe(true);
      expect(plan.customers).toBe(true);
      expect(plan.employees).toBe(true);
      expect(plan.leaves).toBe(true);
      expect(plan.payroll).toBe(true);
      expect(plan.finance).toBe(true);
      expect(plan.audit).toBe(true);
    });
  });

  describe('permission gating', () => {
    it('blocks sales group when user lacks sales/invoices permissions', () => {
      const plan = buildQueryPlan(['todaySales', 'todayRevenue'], NO_PERMISSIONS);
      expect(plan.sales).toBe(false);
      expect(plan.activeGroupCount).toBe(0);
    });

    it('allows sales group when user has invoices.read', () => {
      const plan = buildQueryPlan(['todaySales'], ['invoices.read']);
      expect(plan.sales).toBe(true);
    });

    it('blocks finance group when user lacks finance permissions', () => {
      const plan = buildQueryPlan(['monthlyRevenue', 'revenue'], SALES_ONLY_NO_INVOICES);
      expect(plan.finance).toBe(false);
    });

    it('allows finance group when user has accounting.read', () => {
      const plan = buildQueryPlan(['monthlyRevenue'], ['accounting.read']);
      expect(plan.finance).toBe(true);
    });

    it('blocks inventory group when user lacks inventory.read', () => {
      const plan = buildQueryPlan(['lowStock', 'inventoryValue'], SALES_ONLY);
      expect(plan.inventory).toBe(false);
    });

    it('blocks employees/leaves when user lacks employees.read', () => {
      const plan = buildQueryPlan(['totalEmployees', 'pendingLeaves'], SALES_ONLY);
      expect(plan.employees).toBe(false);
      expect(plan.leaves).toBe(false);
    });

    it('blocks payroll when user lacks payroll.read', () => {
      const plan = buildQueryPlan(['monthlyPayroll'], EMPLOYEE_ONLY.filter((p) => p !== 'payroll.read'));
      expect(plan.payroll).toBe(false);
    });

    it('blocks audit when user lacks audit.read', () => {
      const plan = buildQueryPlan(['activity'], SALES_ONLY);
      expect(plan.audit).toBe(false);
    });
  });

  describe('empty inputs', () => {
    it('returns empty plan for empty sources', () => {
      const plan = buildQueryPlan([], ALL_PERMISSIONS);
      expect(plan.activeGroupCount).toBe(0);
      expect(plan.sales).toBe(false);
      expect(plan.inventory).toBe(false);
    });

    it('returns empty plan for empty permissions', () => {
      const plan = buildQueryPlan(['todaySales'], NO_PERMISSIONS);
      expect(plan.activeGroupCount).toBe(0);
    });
  });

  describe('unknown sources', () => {
    it('ignores unknown sources without crashing', () => {
      const plan = buildQueryPlan(['unknownWidget', 'alsoUnknown'], ALL_PERMISSIONS);
      expect(plan.activeGroupCount).toBe(0);
    });

    it('processes known sources even when mixed with unknown', () => {
      const plan = buildQueryPlan(['todaySales', 'unknownWidget'], SALES_ONLY);
      expect(plan.sales).toBe(true);
      expect(plan.activeGroupCount).toBe(1);
    });
  });

  describe('activeSourcesByGroup tracking', () => {
    it('tracks which sources activated each group', () => {
      const plan = buildQueryPlan(
        ['todaySales', 'todayOrders', 'lowStock', 'totalCustomers'],
        ALL_PERMISSIONS,
      );
      expect(plan.activeSourcesByGroup.sales).toContain('todaySales');
      expect(plan.activeSourcesByGroup.sales).toContain('todayOrders');
      expect(plan.activeSourcesByGroup.inventory).toContain('lowStock');
      expect(plan.activeSourcesByGroup.customers).toContain('totalCustomers');
      expect(plan.activeSourcesByGroup.employees).toHaveLength(0);
    });
  });
});

// ─── getDedupGroup ────────────────────────────────────────────────────────────

describe('getDedupGroup', () => {
  it('returns SALES_DEDUP_GROUP for todaySales', () => {
    expect(getDedupGroup('todaySales')).toBe(SALES_DEDUP_GROUP);
  });

  it('returns SALES_DEDUP_GROUP for todayRevenue', () => {
    expect(getDedupGroup('todayRevenue')).toBe(SALES_DEDUP_GROUP);
  });

  it('returns SALES_DEDUP_GROUP for averageOrderValue', () => {
    expect(getDedupGroup('averageOrderValue')).toBe(SALES_DEDUP_GROUP);
  });

  it('returns SALES_DEDUP_GROUP for topSellingProducts', () => {
    expect(getDedupGroup('topSellingProducts')).toBe(SALES_DEDUP_GROUP);
  });

  it('returns null for non-deduped sources', () => {
    expect(getDedupGroup('lowStock')).toBeNull();
    expect(getDedupGroup('totalCustomers')).toBeNull();
    expect(getDedupGroup('activity')).toBeNull();
  });
});

// ─── getUnknownSources ────────────────────────────────────────────────────────

describe('getUnknownSources', () => {
  it('returns empty array for all known sources', () => {
    const known = getValidSourceKeys();
    expect(getUnknownSources(known)).toHaveLength(0);
  });

  it('filters out unknown sources', () => {
    const result = getUnknownSources(['todaySales', 'fakeSource', 'lowStock']);
    expect(result).toEqual(['fakeSource']);
  });

  it('returns all sources when all are unknown', () => {
    const result = getUnknownSources(['foo', 'bar']);
    expect(result).toEqual(['foo', 'bar']);
  });
});

// ─── getValidSourceKeys ───────────────────────────────────────────────────────

describe('getValidSourceKeys', () => {
  it('returns at least 20 source keys', () => {
    const keys = getValidSourceKeys();
    expect(keys.length).toBeGreaterThanOrEqual(20);
  });

  it('includes key sources from all groups', () => {
    const keys = getValidSourceKeys();
    expect(keys).toContain('todaySales');
    expect(keys).toContain('lowStock');
    expect(keys).toContain('totalCustomers');
    expect(keys).toContain('totalEmployees');
    expect(keys).toContain('pendingLeaves');
    expect(keys).toContain('monthlyPayroll');
    expect(keys).toContain('monthlyRevenue');
    expect(keys).toContain('activity');
  });
});

// ─── getAllQueryGroups ─────────────────────────────────────────────────────────

describe('getAllQueryGroups', () => {
  it('returns exactly 8 query groups', () => {
    expect(getAllQueryGroups()).toHaveLength(8);
  });

  it('includes all expected groups', () => {
    const groups = getAllQueryGroups();
    expect(groups).toContain('sales');
    expect(groups).toContain('inventory');
    expect(groups).toContain('customers');
    expect(groups).toContain('employees');
    expect(groups).toContain('leaves');
    expect(groups).toContain('payroll');
    expect(groups).toContain('finance');
    expect(groups).toContain('audit');
  });
});

// ─── Industry-specific scenarios ──────────────────────────────────────────────

describe('Industry scenarios', () => {
  it('restaurant: only sales + inventory + customers (no employees/payroll)', () => {
    const sources = ['todaySales', 'todayOrders', 'lowStock', 'inventoryValue', 'totalCustomers'];
    const plan = buildQueryPlan(sources, ALL_PERMISSIONS);
    expect(plan.sales).toBe(true);
    expect(plan.inventory).toBe(true);
    expect(plan.customers).toBe(true);
    expect(plan.employees).toBe(false);
    expect(plan.leaves).toBe(false);
    expect(plan.payroll).toBe(false);
    expect(plan.finance).toBe(false);
    expect(plan.activeGroupCount).toBe(3);
  });

  it('hospital: sales + inventory + customers + employees + payroll + leaves', () => {
    const sources = [
      'todaySales', 'todayOrders', 'lowStock', 'totalCustomers',
      'totalEmployees', 'pendingLeaves', 'monthlyPayroll',
    ];
    const plan = buildQueryPlan(sources, ALL_PERMISSIONS);
    expect(plan.sales).toBe(true);
    expect(plan.inventory).toBe(true);
    expect(plan.customers).toBe(true);
    expect(plan.employees).toBe(true);
    expect(plan.leaves).toBe(true);
    expect(plan.payroll).toBe(true);
    expect(plan.activeGroupCount).toBe(6);
  });

  it('school: sales + customers + employees + payroll + leaves (no inventory)', () => {
    const sources = [
      'todaySales', 'totalCustomers',
      'totalEmployees', 'pendingLeaves', 'monthlyPayroll',
    ];
    const plan = buildQueryPlan(sources, ALL_PERMISSIONS);
    expect(plan.sales).toBe(true);
    expect(plan.inventory).toBe(false);
    expect(plan.customers).toBe(true);
    expect(plan.employees).toBe(true);
    expect(plan.leaves).toBe(true);
    expect(plan.payroll).toBe(true);
    expect(plan.activeGroupCount).toBe(5);
  });

  it('general: all groups active with all sources', () => {
    const sources = [
      'todaySales', 'lowStock', 'totalCustomers', 'totalEmployees',
      'pendingLeaves', 'monthlyPayroll', 'monthlyRevenue', 'activity',
    ];
    const plan = buildQueryPlan(sources, ALL_PERMISSIONS);
    expect(plan.activeGroupCount).toBe(8);
  });

  it('limited user on general org: only sales group', () => {
    const sources = [
      'todaySales', 'lowStock', 'totalCustomers', 'totalEmployees',
      'pendingLeaves', 'monthlyPayroll', 'monthlyRevenue', 'activity',
    ];
    const plan = buildQueryPlan(sources, SALES_ONLY_NO_INVOICES);
    expect(plan.sales).toBe(true);
    expect(plan.inventory).toBe(false);
    expect(plan.customers).toBe(false);
    expect(plan.employees).toBe(false);
    expect(plan.leaves).toBe(false);
    expect(plan.payroll).toBe(false);
    expect(plan.finance).toBe(false);
    expect(plan.audit).toBe(false);
    expect(plan.activeGroupCount).toBe(1);
  });
});
