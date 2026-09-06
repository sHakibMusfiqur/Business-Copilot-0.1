import { describe, expect, it } from 'vitest';

import {
  SOURCE_DATA_DEPENDENCIES,
  GROUP_DATA_FIELDS,
  requiredDataFields,
  fieldInGroup,
  fieldOwnerGroup,
} from './dashboard-data-dependencies';
import { getValidSourceKeys, getAllQueryGroups } from './dashboard-query-planner';

// ─── SOURCE_DATA_DEPENDENCIES ──────────────────────────────────────────────────

describe('SOURCE_DATA_DEPENDENCIES', () => {
  it('has entries for all valid source keys', () => {
    const validSources = getValidSourceKeys();
    for (const source of validSources) {
      // aiInsights and quickActions are computed, not DB-backed
      if (source === 'aiInsights' || source === 'quickActions') continue;
      expect(SOURCE_DATA_DEPENDENCIES[source]).toBeDefined();
    }
  });

  it('every DB-backed source maps to at least one data field', () => {
    for (const [source, fields] of Object.entries(SOURCE_DATA_DEPENDENCIES)) {
      // aiInsights and quickActions are computed, not DB-backed
      if (source === 'aiInsights' || source === 'quickActions') continue;
      expect(fields.length).toBeGreaterThan(0);
    }
  });

  it('todaySales source requires todaySales and todayOrders fields', () => {
    const fields = SOURCE_DATA_DEPENDENCIES['todaySales'];
    expect(fields).toContain('todaySales');
    expect(fields).toContain('todayOrders');
  });

  it('todayRevenue source requires todayRevenue and todaySales fields', () => {
    const fields = SOURCE_DATA_DEPENDENCIES['todayRevenue'];
    expect(fields).toContain('todayRevenue');
    expect(fields).toContain('todaySales');
  });

  it('averageOrderValue requires todaySales, todayOrders, and averageOrderValue', () => {
    const fields = SOURCE_DATA_DEPENDENCIES['averageOrderValue'];
    expect(fields).toContain('todaySales');
    expect(fields).toContain('todayOrders');
    expect(fields).toContain('averageOrderValue');
  });

  it('lowStock requires lowStockCount and lowStockProducts', () => {
    const fields = SOURCE_DATA_DEPENDENCIES['lowStock'];
    expect(fields).toContain('lowStockCount');
    expect(fields).toContain('lowStockProducts');
  });

  it('cashFlow requires revenueTrend and expenseTrend', () => {
    const fields = SOURCE_DATA_DEPENDENCIES['cashFlow'];
    expect(fields).toContain('revenueTrend');
    expect(fields).toContain('expenseTrend');
  });
});

// ─── GROUP_DATA_FIELDS ─────────────────────────────────────────────────────────

describe('GROUP_DATA_FIELDS', () => {
  it('has entries for all 8 query groups', () => {
    const groups = getAllQueryGroups();
    for (const group of groups) {
      expect(GROUP_DATA_FIELDS[group]).toBeDefined();
      expect(GROUP_DATA_FIELDS[group].length).toBeGreaterThan(0);
    }
  });

  it('sales group contains totalSalesOrders', () => {
    expect(GROUP_DATA_FIELDS.sales).toContain('totalSalesOrders');
  });

  it('finance group contains monthlyRevenue and monthlyExpense', () => {
    expect(GROUP_DATA_FIELDS.finance).toContain('monthlyRevenue');
    expect(GROUP_DATA_FIELDS.finance).toContain('monthlyExpense');
  });

  it('finance group contains todayExpenses (purchasing metric)', () => {
    expect(GROUP_DATA_FIELDS.finance).toContain('todayExpenses');
  });

  it('inventory group contains lowStockProducts and inventoryValue', () => {
    expect(GROUP_DATA_FIELDS.inventory).toContain('lowStockProducts');
    expect(GROUP_DATA_FIELDS.inventory).toContain('inventoryValue');
  });

  it('customers group contains totalCustomers and newCustomersThisMonth', () => {
    expect(GROUP_DATA_FIELDS.customers).toContain('totalCustomers');
    expect(GROUP_DATA_FIELDS.customers).toContain('newCustomersThisMonth');
  });
});

// ─── requiredDataFields ────────────────────────────────────────────────────────

describe('requiredDataFields', () => {
  it('returns empty set for empty sources', () => {
    const fields = requiredDataFields([]);
    expect(fields.size).toBe(1); // only 'organization'
    expect(fields.has('organization')).toBe(true);
  });

  it('includes organization field for any sources', () => {
    const fields = requiredDataFields(['todaySales']);
    expect(fields.has('organization')).toBe(true);
  });

  it('resolves todaySales source to correct fields', () => {
    const fields = requiredDataFields(['todaySales']);
    expect(fields.has('todaySales')).toBe(true);
    expect(fields.has('todayOrders')).toBe(true);
  });

  it('resolves multiple sources to correct fields', () => {
    const fields = requiredDataFields(['todaySales', 'lowStock', 'totalCustomers']);
    expect(fields.has('todaySales')).toBe(true);
    expect(fields.has('todayOrders')).toBe(true);
    expect(fields.has('lowStockCount')).toBe(true);
    expect(fields.has('lowStockProducts')).toBe(true);
    expect(fields.has('totalCustomers')).toBe(true);
  });

  it('deduplicates fields from multiple sources', () => {
    const fields = requiredDataFields(['todaySales', 'todayRevenue']);
    // Both require todaySales field
    const todaySalesCount = [...fields].filter((f) => f === 'todaySales').length;
    expect(todaySalesCount).toBe(1);
  });

  it('handles unknown sources gracefully', () => {
    const fields = requiredDataFields(['unknownSource', 'todaySales']);
    expect(fields.has('todaySales')).toBe(true);
    expect(fields.has('organization')).toBe(true);
  });
});

// ─── fieldInGroup ──────────────────────────────────────────────────────────────

describe('fieldInGroup', () => {
  it('todaySales is in sales group', () => {
    expect(fieldInGroup('todaySales', 'sales')).toBe(true);
  });

  it('todaySales is NOT in finance group', () => {
    expect(fieldInGroup('todaySales', 'finance')).toBe(false);
  });

  it('monthlyRevenue is in finance group', () => {
    expect(fieldInGroup('monthlyRevenue', 'finance')).toBe(true);
  });

  it('todayExpenses is in finance group (not sales)', () => {
    expect(fieldInGroup('todayExpenses', 'finance')).toBe(true);
    expect(fieldInGroup('todayExpenses', 'sales')).toBe(false);
  });

  it('lowStockCount is in inventory group', () => {
    expect(fieldInGroup('lowStockCount', 'inventory')).toBe(true);
  });
});

// ─── fieldOwnerGroup ───────────────────────────────────────────────────────────

describe('fieldOwnerGroup', () => {
  it('returns sales for todaySales', () => {
    expect(fieldOwnerGroup('todaySales')).toBe('sales');
  });

  it('returns finance for monthlyRevenue', () => {
    expect(fieldOwnerGroup('monthlyRevenue')).toBe('finance');
  });

  it('returns finance for todayExpenses', () => {
    expect(fieldOwnerGroup('todayExpenses')).toBe('finance');
  });

  it('returns null for organization (always-query field)', () => {
    expect(fieldOwnerGroup('organization')).toBeNull();
  });

  it('returns inventory for lowStockCount', () => {
    expect(fieldOwnerGroup('lowStockCount')).toBe('inventory');
  });

  it('returns customers for totalCustomers', () => {
    expect(fieldOwnerGroup('totalCustomers')).toBe('customers');
  });

  it('returns payroll for monthlyPayroll', () => {
    expect(fieldOwnerGroup('monthlyPayroll')).toBe('payroll');
  });

  it('returns leaves for pendingLeaves', () => {
    expect(fieldOwnerGroup('pendingLeaves')).toBe('leaves');
  });

  it('returns audit for recentActivities', () => {
    expect(fieldOwnerGroup('recentActivities')).toBe('audit');
  });
});
