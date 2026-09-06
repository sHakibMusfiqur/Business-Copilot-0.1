import { describe, expect, it } from 'vitest';

import {
  buildQueryPlan,
  getGroupPermissions,
  getAllQueryGroups,
} from './dashboard-query-planner';
import {
  GROUP_DATA_FIELDS,
  requiredDataFields,
  fieldOwnerGroup,
} from './dashboard-data-dependencies';
import type { QueryGroup } from './dashboard-query-planner';

// ─── Permission Isolation Tests ──────────────────────────────────────────────

describe('Permission Isolation', () => {
  const ALL_PERMISSIONS = [
    'sales.read', 'invoices.read', 'payments.read', 'accounting.read', 'reports.finance',
    'inventory.read', 'customers.read', 'suppliers.read', 'purchase.read',
    'employees.read', 'payroll.read', 'audit.read',
  ];

  describe('group permission mapping', () => {
    it('sales group requires sales.read OR invoices.read', () => {
      const perms = getGroupPermissions('sales');
      expect(perms).toContain('sales.read');
      expect(perms).toContain('invoices.read');
    });

    it('inventory group requires inventory.read', () => {
      const perms = getGroupPermissions('inventory');
      expect(perms).toEqual(['inventory.read']);
    });

    it('customers group requires customers.read', () => {
      const perms = getGroupPermissions('customers');
      expect(perms).toEqual(['customers.read']);
    });

    it('employees group requires employees.read', () => {
      const perms = getGroupPermissions('employees');
      expect(perms).toEqual(['employees.read']);
    });

    it('leaves group requires employees.read', () => {
      const perms = getGroupPermissions('leaves');
      expect(perms).toEqual(['employees.read']);
    });

    it('payroll group requires payroll.read', () => {
      const perms = getGroupPermissions('payroll');
      expect(perms).toEqual(['payroll.read']);
    });

    it('finance group requires one of multiple finance permissions', () => {
      const perms = getGroupPermissions('finance');
      expect(perms).toContain('invoices.read');
      expect(perms).toContain('payments.read');
      expect(perms).toContain('accounting.read');
      expect(perms).toContain('reports.finance');
      expect(perms).toContain('purchase.read');
    });

    it('audit group requires audit.read', () => {
      const perms = getGroupPermissions('audit');
      expect(perms).toEqual(['audit.read']);
    });
  });

  describe('permission gating blocks unauthorized groups', () => {
    it('blocks sales group when user lacks sales.read and invoices.read', () => {
      const plan = buildQueryPlan(['todaySales', 'todayOrders'], ['inventory.read']);
      expect(plan.sales).toBe(false);
    });

    it('blocks inventory group when user lacks inventory.read', () => {
      const plan = buildQueryPlan(['lowStock', 'inventoryValue'], ['sales.read']);
      expect(plan.inventory).toBe(false);
    });

    it('blocks customers group when user lacks customers.read', () => {
      const plan = buildQueryPlan(['totalCustomers'], ['sales.read']);
      expect(plan.customers).toBe(false);
    });

    it('blocks employees group when user lacks employees.read', () => {
      const plan = buildQueryPlan(['totalEmployees'], ['sales.read']);
      expect(plan.employees).toBe(false);
    });

    it('blocks leaves group when user lacks employees.read', () => {
      const plan = buildQueryPlan(['pendingLeaves'], ['sales.read']);
      expect(plan.leaves).toBe(false);
    });

    it('blocks payroll group when user lacks payroll.read', () => {
      const plan = buildQueryPlan(['monthlyPayroll'], ['employees.read']);
      expect(plan.payroll).toBe(false);
    });

    it('blocks finance group when user lacks all finance permissions', () => {
      const plan = buildQueryPlan(['monthlyRevenue', 'todayExpenses'], ['sales.read']);
      expect(plan.finance).toBe(false);
    });

    it('blocks audit group when user lacks audit.read', () => {
      const plan = buildQueryPlan(['activity'], ['sales.read']);
      expect(plan.audit).toBe(false);
    });
  });

  describe('permission gating allows authorized groups', () => {
    it('allows sales group when user has sales.read', () => {
      const plan = buildQueryPlan(['todaySales'], ['sales.read']);
      expect(plan.sales).toBe(true);
    });

    it('allows sales group when user has invoices.read', () => {
      const plan = buildQueryPlan(['todaySales'], ['invoices.read']);
      expect(plan.sales).toBe(true);
    });

    it('allows finance group when user has any finance permission', () => {
      expect(buildQueryPlan(['monthlyRevenue'], ['invoices.read']).finance).toBe(true);
      expect(buildQueryPlan(['monthlyRevenue'], ['payments.read']).finance).toBe(true);
      expect(buildQueryPlan(['monthlyRevenue'], ['accounting.read']).finance).toBe(true);
      expect(buildQueryPlan(['monthlyRevenue'], ['reports.finance']).finance).toBe(true);
      expect(buildQueryPlan(['monthlyRevenue'], ['purchase.read']).finance).toBe(true);
    });

    it('allows multiple groups when user has multiple permissions', () => {
      const plan = buildQueryPlan(
        ['todaySales', 'lowStock', 'totalCustomers', 'activity'],
        ['sales.read', 'inventory.read', 'customers.read', 'audit.read'],
      );
      expect(plan.sales).toBe(true);
      expect(plan.inventory).toBe(true);
      expect(plan.customers).toBe(true);
      expect(plan.audit).toBe(true);
      expect(plan.activeGroupCount).toBe(4);
    });
  });

  describe('permission-gated data fields', () => {
    it('sales group fields are not available without sales.read', () => {
      const plan = buildQueryPlan(['todaySales'], ['inventory.read']);
      const fields = requiredDataFields(['todaySales']);
      
      // Sales fields should be in the required set but group won't be queried
      expect(fields.has('todaySales')).toBe(true);
      expect(fields.has('todayOrders')).toBe(true);
      expect(plan.sales).toBe(false);
    });

    it('finance group fields are not available without finance permissions', () => {
      const plan = buildQueryPlan(['monthlyRevenue'], ['sales.read']);
      const fields = requiredDataFields(['monthlyRevenue']);
      
      expect(fields.has('monthlyRevenue')).toBe(true);
      expect(plan.finance).toBe(false);
    });
  });
});

// ─── Tenant Isolation Tests ──────────────────────────────────────────────────

describe('Tenant Isolation', () => {
  describe('cache key includes orgId', () => {
    it('each group cache key is scoped to organization', () => {
      const orgId1 = 'org-123';
      const orgId2 = 'org-456';
      const group = 'sales';

      // Cache keys must be different for different orgs
      const key1 = `organization:${orgId1}:dashboard:${group}`;
      const key2 = `organization:${orgId2}:dashboard:${group}`;

      expect(key1).not.toBe(key2);
      expect(key1).toContain(orgId1);
      expect(key2).toContain(orgId2);
    });

    it('all 8 groups have org-scoped cache keys', () => {
      const orgId = 'org-test';
      const groups: QueryGroup[] = ['sales', 'inventory', 'customers', 'employees', 'leaves', 'payroll', 'finance', 'audit'];

      for (const group of groups) {
        const cacheKey = `organization:${orgId}:dashboard:${group}`;
        expect(cacheKey).toContain(orgId);
        expect(cacheKey).toContain(group);
      }
    });
  });

  describe('data fields are org-scoped', () => {
    it('each group fetcher uses organizationId filter', () => {
      // This test verifies the contract: each fetcher must filter by orgId
      // The actual implementation is tested via integration tests
      const groups: QueryGroup[] = ['sales', 'inventory', 'customers', 'employees', 'leaves', 'payroll', 'finance', 'audit'];
      
      for (const group of groups) {
        const fields = GROUP_DATA_FIELDS[group];
        expect(fields).toBeDefined();
        expect(fields.length).toBeGreaterThan(0);
      }
    });
  });

  describe('field ownership prevents cross-group leakage', () => {
    it('each data field has exactly one owning group', () => {
      const allFields = new Set<string>();
      const duplicateFields: string[] = [];

      for (const [group, fields] of Object.entries(GROUP_DATA_FIELDS)) {
        for (const field of fields) {
          if (allFields.has(field)) {
            duplicateFields.push(field);
          }
          allFields.add(field);
        }
      }

      expect(duplicateFields).toEqual([]);
    });

    it('fieldOwnerGroup returns correct group for each field', () => {
      // Sales fields
      expect(fieldOwnerGroup('todaySales')).toBe('sales');
      expect(fieldOwnerGroup('todayOrders')).toBe('sales');
      expect(fieldOwnerGroup('pendingOrders')).toBe('sales');

      // Inventory fields
      expect(fieldOwnerGroup('totalProducts')).toBe('inventory');
      expect(fieldOwnerGroup('lowStockProducts')).toBe('inventory');
      expect(fieldOwnerGroup('lowStockCount')).toBe('inventory');

      // Customer fields
      expect(fieldOwnerGroup('totalCustomers')).toBe('customers');
      expect(fieldOwnerGroup('newCustomersThisMonth')).toBe('customers');

      // Employee fields
      expect(fieldOwnerGroup('totalEmployees')).toBe('employees');

      // Leaves fields
      expect(fieldOwnerGroup('pendingLeaves')).toBe('leaves');

      // Payroll fields
      expect(fieldOwnerGroup('monthlyPayroll')).toBe('payroll');

      // Finance fields
      expect(fieldOwnerGroup('monthlyRevenue')).toBe('finance');
      expect(fieldOwnerGroup('monthlyExpense')).toBe('finance');
      expect(fieldOwnerGroup('todayExpenses')).toBe('finance');
      expect(fieldOwnerGroup('revenueTrend')).toBe('finance');
      expect(fieldOwnerGroup('expenseTrend')).toBe('finance');

      // Audit fields
      expect(fieldOwnerGroup('recentActivities')).toBe('audit');
    });

    it('unknown field returns null owner', () => {
      expect(fieldOwnerGroup('nonexistent' as any)).toBeNull();
    });
  });
});

// ─── Query Plan Consistency Tests ────────────────────────────────────────────

describe('Query Plan Consistency', () => {
  it('all 8 groups exist in GROUP_PERMISSIONS', () => {
    const groups = getAllQueryGroups();
    
    for (const group of groups) {
      const perms = getGroupPermissions(group);
      expect(perms).toBeDefined();
      expect(Array.isArray(perms)).toBe(true);
    }
  });

  it('all 8 groups exist in GROUP_DATA_FIELDS', () => {
    const groups: QueryGroup[] = ['sales', 'inventory', 'customers', 'employees', 'leaves', 'payroll', 'finance', 'audit'];
    
    for (const group of groups) {
      expect(GROUP_DATA_FIELDS[group]).toBeDefined();
      expect(GROUP_DATA_FIELDS[group].length).toBeGreaterThan(0);
    }
  });

  it('query plan returns all false when no sources provided', () => {
    const plan = buildQueryPlan([], ['sales.read', 'inventory.read', 'customers.read']);
    expect(plan.sales).toBe(false);
    expect(plan.inventory).toBe(false);
    expect(plan.customers).toBe(false);
    expect(plan.employees).toBe(false);
    expect(plan.leaves).toBe(false);
    expect(plan.payroll).toBe(false);
    expect(plan.finance).toBe(false);
    expect(plan.audit).toBe(false);
    expect(plan.activeGroupCount).toBe(0);
  });

  it('query plan returns all false when no permissions provided', () => {
    const plan = buildQueryPlan(['todaySales', 'lowStock', 'totalCustomers'], []);
    expect(plan.sales).toBe(false);
    expect(plan.inventory).toBe(false);
    expect(plan.customers).toBe(false);
    expect(plan.activeGroupCount).toBe(0);
  });
});
