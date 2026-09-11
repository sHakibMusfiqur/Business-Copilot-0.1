

import type { QueryGroup } from './dashboard-query-planner';

// ─── Data Field Names ──────────────────────────────────────────────────────────


export type DataField =
  // ─── Organization ───
  | 'organization'
  // ─── Statistics (overview counts) ───
  | 'totalUsers'
  | 'totalCustomers'
  | 'totalProducts'
  | 'totalSuppliers'
  | 'totalInvoices'
  | 'totalPurchaseOrders'
  | 'totalSalesOrders'
  | 'lowStockProducts'
  | 'monthlyRevenue'
  | 'monthlyExpense'
  | 'totalEmployees'
  | 'pendingLeaves'
  | 'monthlyPayroll'
  // ─── Industry Metrics (today's data) ───
  | 'todaySales'
  | 'todayOrders'
  | 'todayRevenue'
  | 'todayExpenses'
  | 'pendingOrders'
  | 'completedOrders'
  | 'cancelledOrders'
  | 'averageOrderValue'
  | 'lowStockCount'
  | 'inventoryValue'
  | 'newCustomersThisMonth'
  | 'topSellingProducts'
  | 'recentOrders'
  // ─── Trends ───
  | 'revenueTrend'
  | 'expenseTrend'
  | 'salesTrend'
  // ─── Activities ───
  | 'recentActivities'
  // ─── Computed (no DB query) ───
  | 'quickActions'
  | 'aiInsights';

// ─── Group → Data Fields ───────────────────────────────────────────────────────

export const GROUP_DATA_FIELDS: Record<QueryGroup, DataField[]> = {
  sales: [
    'totalSalesOrders',
    'todaySales',
    'todayOrders',
    'todayRevenue',
    'pendingOrders',
    'completedOrders',
    'cancelledOrders',
    'averageOrderValue',
    'topSellingProducts',
    'recentOrders',
    'salesTrend',
  ],
  inventory: [
    'totalProducts',
    'lowStockProducts',
    'lowStockCount',
    'inventoryValue',
  ],
  customers: [
    'totalCustomers',
    'newCustomersThisMonth',
  ],
  employees: [
    'totalEmployees',
  ],
  leaves: [
    'pendingLeaves',
  ],
  payroll: [
    'monthlyPayroll',
  ],
  finance: [
    'totalInvoices',
    'totalPurchaseOrders',
    'monthlyRevenue',
    'monthlyExpense',
    'todayExpenses',
    'revenueTrend',
    'expenseTrend',
  ],
  audit: [
    'recentActivities',
  ],
  people: [
    'totalUsers',
    'totalSuppliers',
  ],
};

// ─── Source → Data Fields ──────────────────────────────────────────────────────


export const SOURCE_DATA_DEPENDENCIES: Record<string, DataField[]> = {
  // ─── Sales group ───
  todaySales:           ['todaySales', 'todayOrders'],
  todayOrders:          ['todayOrders'],
  todayRevenue:         ['todayRevenue', 'todaySales'],
  pendingOrders:        ['pendingOrders'],
  completedOrders:      ['completedOrders'],
  cancelledOrders:      ['cancelledOrders'],
  averageOrderValue:    ['todaySales', 'todayOrders', 'averageOrderValue'],
  recentOrders:         ['recentOrders'],
  topSellingProducts:   ['topSellingProducts'],
  // salesTrend is driven by the salesTrend source
  salesTrend:           ['salesTrend'],

  // ─── Inventory group ───
  lowStock:             ['lowStockCount', 'lowStockProducts'],
  inventoryValue:       ['inventoryValue'],

  // ─── Customers group ───
  totalCustomers:       ['totalCustomers'],
  newCustomersThisMonth: ['newCustomersThisMonth'],

  // ─── Employees group ───
  totalEmployees:       ['totalEmployees'],

  // ─── Leaves group ───
  pendingLeaves:        ['pendingLeaves'],

  // ─── Payroll group ───
  monthlyPayroll:       ['monthlyPayroll'],

  // ─── Finance group ───
  monthlyRevenue:       ['monthlyRevenue'],
  todayExpenses:        ['todayExpenses'],
  revenue:              ['revenueTrend'],
  cashFlow:             ['revenueTrend', 'expenseTrend'],
  expenseTrend:         ['expenseTrend'],

  // ─── Audit group ───
  activity:             ['recentActivities'],

  // ─── People group ───
  totalUsers:           ['totalUsers'],
  totalSuppliers:       ['totalSuppliers'],

  // ─── No DB query required ───
  aiInsights:           [],
  quickActions:         [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Always-query fields that are not gated by any group (org metadata, computed). */
export const ALWAYS_QUERY_FIELDS: DataField[] = ['organization', 'totalUsers', 'totalSuppliers'];


export function requiredDataFields(sources: string[]): Set<DataField> {
  const fields = new Set<DataField>(ALWAYS_QUERY_FIELDS);
  for (const source of sources) {
    const deps = SOURCE_DATA_DEPENDENCIES[source];
    if (deps) {
      for (const field of deps) {
        fields.add(field);
      }
    }
  }
  return fields;
}


export function groupDataFields(group: QueryGroup): DataField[] {
  return GROUP_DATA_FIELDS[group] ?? [];
}


export function fieldInGroup(field: DataField, group: QueryGroup): boolean {
  return GROUP_DATA_FIELDS[group]?.includes(field) ?? false;
}


export function fieldOwnerGroup(field: DataField): QueryGroup | null {
  for (const [group, fields] of Object.entries(GROUP_DATA_FIELDS)) {
    if ((fields as DataField[]).includes(field)) {
      return group as QueryGroup;
    }
  }
  return null;
}
