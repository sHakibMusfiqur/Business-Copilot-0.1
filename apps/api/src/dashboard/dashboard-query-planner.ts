
// ─── Query Groups ─────────────────────────────────────────────────────────────

export type QueryGroup =
  | 'sales'
  | 'inventory'
  | 'customers'
  | 'employees'
  | 'leaves'
  | 'payroll'
  | 'finance'
  | 'audit';

/** The query plan: which groups must be loaded. */
export interface QueryPlan {
  sales: boolean;
  inventory: boolean;
  customers: boolean;
  employees: boolean;
  leaves: boolean;
  payroll: boolean;
  finance: boolean;
  audit: boolean;
  /** Count of groups that will be queried (for observability). */
  activeGroupCount: number;
  /** The sources that caused each group to be active (for observability). */
  activeSourcesByGroup: Record<QueryGroup, string[]>;
}

// ─── Source → Group Mapping ────────────────────────────────────────────────────


const SOURCE_TO_GROUP: Record<string, QueryGroup> = {
  // ─── Sales ───
  todaySales: 'sales',
  todayOrders: 'sales',
  todayRevenue: 'sales',
  pendingOrders: 'sales',
  completedOrders: 'sales',
  cancelledOrders: 'sales',
  averageOrderValue: 'sales',
  recentOrders: 'sales',
  topSellingProducts: 'sales',
  salesTrend: 'sales',

  // ─── Inventory ───
  lowStock: 'inventory',
  inventoryValue: 'inventory',

  // ─── Customers ───
  totalCustomers: 'customers',
  newCustomersThisMonth: 'customers',

  // ─── Employees ───
  totalEmployees: 'employees',

  // ─── Leaves ───
  pendingLeaves: 'leaves',

  // ─── Payroll ───
  monthlyPayroll: 'payroll',

  // ─── Finance (includes purchasing expense metrics) ───
  monthlyRevenue: 'finance',
  todayExpenses: 'finance',
  revenue: 'finance',
  cashFlow: 'finance',
  expenseTrend: 'finance',

  // ─── Audit ───
  activity: 'audit',
};

// ─── Permission → Group Mapping ────────────────────────────────────────────────


const GROUP_PERMISSIONS: Record<QueryGroup, string[]> = {
  sales:     ['sales.read', 'invoices.read'],
  inventory: ['inventory.read'],
  customers: ['customers.read'],
  employees: ['employees.read'],
  leaves:    ['employees.read'],
  payroll:   ['payroll.read'],
  finance:   ['invoices.read', 'payments.read', 'accounting.read', 'reports.finance', 'purchase.read'],
  audit:     ['audit.read'],
};

// ─── Plan Builder ──────────────────────────────────────────────────────────────


export function buildQueryPlan(
  requiredSources: string[],
  permissions: string[],
): QueryPlan {
  const plan: QueryPlan = {
    sales: false,
    inventory: false,
    customers: false,
    employees: false,
    leaves: false,
    payroll: false,
    finance: false,
    audit: false,
    activeGroupCount: 0,
    activeSourcesByGroup: {
      sales: [],
      inventory: [],
      customers: [],
      employees: [],
      leaves: [],
      payroll: [],
      finance: [],
      audit: [],
    },
  };

  const hasPermission = (...required: string[]): boolean =>
    required.some((p) => permissions.includes(p));

  for (const source of requiredSources) {
    const group = SOURCE_TO_GROUP[source];
    if (!group) continue;

    // Check permission for this group
    const groupPerms = GROUP_PERMISSIONS[group];
    if (groupPerms.length > 0 && !hasPermission(...groupPerms)) {
      continue;
    }

    // Mark group as active
    if (!plan[group]) {
      plan[group] = true;
      plan.activeGroupCount++;
    }
    plan.activeSourcesByGroup[group].push(source);
  }

  return plan;
}

// ─── Validation Helpers ────────────────────────────────────────────────────────

/** Get all valid source keys (for validation). */
export function getValidSourceKeys(): string[] {
  return Object.keys(SOURCE_TO_GROUP);
}

/** Get all query groups. */
export function getAllQueryGroups(): QueryGroup[] {
  return ['sales', 'inventory', 'customers', 'employees', 'leaves', 'payroll', 'finance', 'audit'];
}

/** Get the group for a source, or null if unknown. */
export function getSourceGroup(source: string): QueryGroup | null {
  return SOURCE_TO_GROUP[source] ?? null;
}

/** Get the permissions for a group. */
export function getGroupPermissions(group: QueryGroup): string[] {
  return GROUP_PERMISSIONS[group] ?? [];
}
