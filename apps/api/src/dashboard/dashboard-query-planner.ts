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
  todayExpenses: 'sales',
  pendingOrders: 'sales',
  completedOrders: 'sales',
  cancelledOrders: 'sales',
  averageOrderValue: 'sales',
  recentOrders: 'sales',
  topSellingProducts: 'sales',

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

  // ─── Finance ───
  monthlyRevenue: 'finance',
  revenue: 'finance',
  cashFlow: 'finance',

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
  finance:   ['invoices.read', 'payments.read', 'accounting.read', 'reports.finance'],
  audit:     ['audit.read'],
};

// ─── Deduplication: Shared Aggregates ──────────────────────────────────────────


export const SALES_DEDUP_GROUP = 'salesAggregate';

const DEDUP_GROUPS: Record<string, string[]> = {
  [SALES_DEDUP_GROUP]: ['todaySales', 'todayRevenue', 'averageOrderValue', 'topSellingProducts'],
};

/** Get the dedup group for a source, or null if no dedup. */
export function getDedupGroup(source: string): string | null {
  for (const [group, sources] of Object.entries(DEDUP_GROUPS)) {
    if (sources.includes(source)) return group;
  }
  return null;
}

// ─── Plan Builder ──────────────────────────────────────────────────────────────

/** Warn about unknown sources (once per source). */
const warnedSources = new Set<string>();


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

    if (!group) {
      if (!warnedSources.has(source)) {
        warnedSources.add(source);
        // Warning logged by caller — planner stays pure
      }
      continue;
    }

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


export function getUnknownSources(sources: string[]): string[] {
  return sources.filter((s) => !(s in SOURCE_TO_GROUP) && !Object.values(DEDUP_GROUPS).some((g) => g.includes(s)));
}

/** Get all valid source keys (for validation). */
export function getValidSourceKeys(): string[] {
  return Object.keys(SOURCE_TO_GROUP);
}

/** Get all query groups. */
export function getAllQueryGroups(): QueryGroup[] {
  return ['sales', 'inventory', 'customers', 'employees', 'leaves', 'payroll', 'finance', 'audit'];
}
