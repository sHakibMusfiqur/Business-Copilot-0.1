

export type WidgetKey =
  | 'metric'
  | 'metricCurrency'
  | 'trend'
  | 'revenueTrend'
  | 'salesTrend'
  | 'cashFlow'
  | 'donut'
  | 'list'
  | 'activity'
  | 'aiInsights'
  | 'healthScore'
  | 'approvals'
  | 'calendar'
  | 'quickActions'
  | 'forecast';

export type WidgetZone = 'hero' | 'charts' | 'side' | 'bottom' | 'insights';
export type WidgetSpan = 3 | 4 | 5 | 6 | 7 | 8 | 12;

export interface WidgetConfig {
  id: string;
  source: string;
  key: WidgetKey;
  zone: WidgetZone;
  span: WidgetSpan;
  permission?: string[];
  supported: boolean;
  title?: string;
}

export interface IndustryDashboardConfig {
  industry: string;
  kpis: WidgetConfig[];
  charts: WidgetConfig[];
  secondary: WidgetConfig[];
  alerts: WidgetConfig[];
  insights: WidgetConfig[];
  bottom: WidgetConfig[];
}

export type IndustryKey =
  | 'restaurant'
  | 'hospital'
  | 'manufacturing'
  | 'school'
  | 'software'
  | 'retail'
  | 'pharmacy'
  | 'garments'
  | 'it-services'
  | 'general';

const FINANCE_PERMS = ['invoices.read', 'payments.read', 'accounting.read', 'reports.finance'];
const SALES_PERMS = ['sales.read', 'invoices.read'];
const INVENTORY_PERMS = ['inventory.read'];
const EMPLOYEE_PERMS = ['employees.read'];
const CUSTOMER_PERMS = ['customers.read'];
const AUDIT_PERMS = ['audit.read'];

const baseFinance: WidgetConfig[] = [
  { id: 'revenueTrend', source: 'revenue', key: 'revenueTrend', zone: 'charts', span: 8, permission: FINANCE_PERMS, supported: true },
  { id: 'cashFlow', source: 'cashFlow', key: 'cashFlow', zone: 'charts', span: 4, permission: FINANCE_PERMS, supported: true },
];

const baseInsights: WidgetConfig[] = [
  { id: 'aiInsights', source: 'aiInsights', key: 'aiInsights', zone: 'insights', span: 12, permission: ['ai.read'], supported: true },
];

const baseBottom: WidgetConfig[] = [
  { id: 'activity', source: 'activity', key: 'activity', zone: 'bottom', span: 7, permission: AUDIT_PERMS, supported: true },
  { id: 'quickActions', source: 'quickActions', key: 'quickActions', zone: 'bottom', span: 5, supported: true },
];

// ─── Restaurant ───
const restaurantConfig: IndustryDashboardConfig = {
  industry: 'restaurant',
  kpis: [
    { id: 'todaySales', source: 'todaySales', key: 'metricCurrency', zone: 'hero', span: 3, permission: SALES_PERMS, supported: true, title: "Today's Sales" },
    { id: 'todayOrders', source: 'todayOrders', key: 'metric', zone: 'hero', span: 3, permission: SALES_PERMS, supported: true, title: 'Orders Today' },
    { id: 'averageTicket', source: 'averageTicket', key: 'metricCurrency', zone: 'hero', span: 3, permission: SALES_PERMS, supported: true, title: 'Average Ticket' },
    { id: 'pendingOrders', source: 'pendingOrders', key: 'metric', zone: 'hero', span: 3, permission: SALES_PERMS, supported: true, title: 'Pending Orders' },
  ],
  charts: [
    ...baseFinance,
  ],
  secondary: [
    { id: 'lowStock', source: 'lowStock', key: 'list', zone: 'side', span: 6, permission: INVENTORY_PERMS, supported: true, title: 'Low Stock Items' },
    { id: 'recentOrders', source: 'recentOrders', key: 'list', zone: 'side', span: 6, permission: SALES_PERMS, supported: true, title: 'Recent Orders' },
  ],
  alerts: [
    { id: 'lowStockAlert', source: 'lowStock', key: 'metric', zone: 'side', span: 4, permission: INVENTORY_PERMS, supported: true, title: 'Low Stock Alert' },
  ],
  insights: baseInsights,
  bottom: baseBottom,
};

// ─── Hospital ───
const hospitalConfig: IndustryDashboardConfig = {
  industry: 'hospital',
  kpis: [
    { id: 'todayOrders', source: 'todayOrders', key: 'metric', zone: 'hero', span: 3, permission: SALES_PERMS, supported: true, title: 'Appointments Today' },
    { id: 'pendingOrders', source: 'pendingOrders', key: 'metric', zone: 'hero', span: 3, permission: SALES_PERMS, supported: true, title: 'Pending Cases' },
    { id: 'completedOrders', source: 'completedOrders', key: 'metric', zone: 'hero', span: 3, permission: SALES_PERMS, supported: true, title: 'Completed Today' },
    { id: 'todayRevenue', source: 'todayRevenue', key: 'metricCurrency', zone: 'hero', span: 3, permission: FINANCE_PERMS, supported: true, title: "Today's Revenue" },
  ],
  charts: [
    ...baseFinance,
  ],
  secondary: [
    { id: 'newCustomers', source: 'newCustomersThisMonth', key: 'metric', zone: 'side', span: 6, permission: CUSTOMER_PERMS, supported: true, title: 'New Patients This Month' },
    { id: 'lowStock', source: 'lowStock', key: 'list', zone: 'side', span: 6, permission: INVENTORY_PERMS, supported: true, title: 'Low Stock Items' },
  ],
  alerts: [],
  insights: baseInsights,
  bottom: baseBottom,
};

// ─── Manufacturing ───
const manufacturingConfig: IndustryDashboardConfig = {
  industry: 'manufacturing',
  kpis: [
    { id: 'todayOrders', source: 'todayOrders', key: 'metric', zone: 'hero', span: 3, permission: SALES_PERMS, supported: true, title: 'Orders Today' },
    { id: 'completedOrders', source: 'completedOrders', key: 'metric', zone: 'hero', span: 3, permission: SALES_PERMS, supported: true, title: 'Completed Orders' },
    { id: 'pendingOrders', source: 'pendingOrders', key: 'metric', zone: 'hero', span: 3, permission: SALES_PERMS, supported: true, title: 'Pending Orders' },
    { id: 'todayRevenue', source: 'todayRevenue', key: 'metricCurrency', zone: 'hero', span: 3, permission: FINANCE_PERMS, supported: true, title: "Today's Revenue" },
  ],
  charts: [
    ...baseFinance,
  ],
  secondary: [
    { id: 'lowStock', source: 'lowStock', key: 'list', zone: 'side', span: 6, permission: INVENTORY_PERMS, supported: true, title: 'Low Stock Items' },
    { id: 'recentOrders', source: 'recentOrders', key: 'list', zone: 'side', span: 6, permission: SALES_PERMS, supported: true, title: 'Recent Orders' },
  ],
  alerts: [
    { id: 'lowStockAlert', source: 'lowStock', key: 'metric', zone: 'side', span: 4, permission: INVENTORY_PERMS, supported: true, title: 'Low Stock Alert' },
  ],
  insights: baseInsights,
  bottom: baseBottom,
};

// ─── School ───
const schoolConfig: IndustryDashboardConfig = {
  industry: 'school',
  kpis: [
    { id: 'totalCustomers', source: 'totalCustomers', key: 'metric', zone: 'hero', span: 3, permission: CUSTOMER_PERMS, supported: true, title: 'Students' },
    { id: 'todayOrders', source: 'todayOrders', key: 'metric', zone: 'hero', span: 3, permission: SALES_PERMS, supported: true, title: 'Transactions Today' },
    { id: 'todayRevenue', source: 'todayRevenue', key: 'metricCurrency', zone: 'hero', span: 3, permission: FINANCE_PERMS, supported: true, title: 'Fees Collected Today' },
    { id: 'pendingOrders', source: 'pendingOrders', key: 'metric', zone: 'hero', span: 3, permission: SALES_PERMS, supported: true, title: 'Pending Dues' },
  ],
  charts: [
    ...baseFinance,
  ],
  secondary: [
    { id: 'totalEmployees', source: 'totalEmployees', key: 'metric', zone: 'side', span: 6, permission: EMPLOYEE_PERMS, supported: true, title: 'Staff Count' },
    { id: 'recentOrders', source: 'recentOrders', key: 'list', zone: 'side', span: 6, permission: SALES_PERMS, supported: true, title: 'Recent Transactions' },
  ],
  alerts: [],
  insights: baseInsights,
  bottom: baseBottom,
};

// ─── Software ───
const softwareConfig: IndustryDashboardConfig = {
  industry: 'software',
  kpis: [
    { id: 'todayRevenue', source: 'todayRevenue', key: 'metricCurrency', zone: 'hero', span: 3, permission: FINANCE_PERMS, supported: true, title: "Today's Revenue" },
    { id: 'pendingOrders', source: 'pendingOrders', key: 'metric', zone: 'hero', span: 3, permission: SALES_PERMS, supported: true, title: 'Open Projects' },
    { id: 'completedOrders', source: 'completedOrders', key: 'metric', zone: 'hero', span: 3, permission: SALES_PERMS, supported: true, title: 'Completed Tasks' },
    { id: 'newCustomers', source: 'newCustomersThisMonth', key: 'metric', zone: 'hero', span: 3, permission: CUSTOMER_PERMS, supported: true, title: 'New Clients' },
  ],
  charts: [
    ...baseFinance,
  ],
  secondary: [
    { id: 'recentOrders', source: 'recentOrders', key: 'list', zone: 'side', span: 6, permission: SALES_PERMS, supported: true, title: 'Recent Orders' },
    { id: 'lowStock', source: 'lowStock', key: 'list', zone: 'side', span: 6, permission: INVENTORY_PERMS, supported: true, title: 'Low Stock Items' },
  ],
  alerts: [],
  insights: baseInsights,
  bottom: baseBottom,
};

// ─── Retail ───
const retailConfig: IndustryDashboardConfig = {
  industry: 'retail',
  kpis: [
    { id: 'todaySales', source: 'todaySales', key: 'metricCurrency', zone: 'hero', span: 3, permission: SALES_PERMS, supported: true, title: "Today's Sales" },
    { id: 'todayOrders', source: 'todayOrders', key: 'metric', zone: 'hero', span: 3, permission: SALES_PERMS, supported: true, title: 'Transactions' },
    { id: 'averageTicket', source: 'averageTicket', key: 'metricCurrency', zone: 'hero', span: 3, permission: SALES_PERMS, supported: true, title: 'Avg Order Value' },
    { id: 'pendingOrders', source: 'pendingOrders', key: 'metric', zone: 'hero', span: 3, permission: SALES_PERMS, supported: true, title: 'Pending Orders' },
  ],
  charts: [
    ...baseFinance,
  ],
  secondary: [
    { id: 'lowStock', source: 'lowStock', key: 'list', zone: 'side', span: 6, permission: INVENTORY_PERMS, supported: true, title: 'Low Stock Items' },
    { id: 'recentOrders', source: 'recentOrders', key: 'list', zone: 'side', span: 6, permission: SALES_PERMS, supported: true, title: 'Recent Orders' },
  ],
  alerts: [
    { id: 'lowStockAlert', source: 'lowStock', key: 'metric', zone: 'side', span: 4, permission: INVENTORY_PERMS, supported: true, title: 'Low Stock Alert' },
  ],
  insights: baseInsights,
  bottom: baseBottom,
};

// ─── Pharmacy ───
const pharmacyConfig: IndustryDashboardConfig = {
  industry: 'pharmacy',
  kpis: [
    { id: 'todaySales', source: 'todaySales', key: 'metricCurrency', zone: 'hero', span: 3, permission: SALES_PERMS, supported: true, title: "Today's Sales" },
    { id: 'todayOrders', source: 'todayOrders', key: 'metric', zone: 'hero', span: 3, permission: SALES_PERMS, supported: true, title: 'Prescriptions Today' },
    { id: 'pendingOrders', source: 'pendingOrders', key: 'metric', zone: 'hero', span: 3, permission: SALES_PERMS, supported: true, title: 'Pending Orders' },
    { id: 'todayRevenue', source: 'todayRevenue', key: 'metricCurrency', zone: 'hero', span: 3, permission: FINANCE_PERMS, supported: true, title: "Today's Revenue" },
  ],
  charts: [
    ...baseFinance,
  ],
  secondary: [
    { id: 'lowStock', source: 'lowStock', key: 'list', zone: 'side', span: 12, permission: INVENTORY_PERMS, supported: true, title: 'Low Stock Items' },
  ],
  alerts: [
    { id: 'lowStockAlert', source: 'lowStock', key: 'metric', zone: 'side', span: 4, permission: INVENTORY_PERMS, supported: true, title: 'Low Stock Alert' },
  ],
  insights: baseInsights,
  bottom: baseBottom,
};

// ─── Garments ───
const garmentsConfig: IndustryDashboardConfig = {
  industry: 'garments',
  kpis: [
    { id: 'todayOrders', source: 'todayOrders', key: 'metric', zone: 'hero', span: 3, permission: SALES_PERMS, supported: true, title: 'Orders Today' },
    { id: 'pendingOrders', source: 'pendingOrders', key: 'metric', zone: 'hero', span: 3, permission: SALES_PERMS, supported: true, title: 'Pending Delivery' },
    { id: 'completedOrders', source: 'completedOrders', key: 'metric', zone: 'hero', span: 3, permission: SALES_PERMS, supported: true, title: 'Completed Orders' },
    { id: 'todayRevenue', source: 'todayRevenue', key: 'metricCurrency', zone: 'hero', span: 3, permission: FINANCE_PERMS, supported: true, title: "Today's Revenue" },
  ],
  charts: [
    ...baseFinance,
  ],
  secondary: [
    { id: 'lowStock', source: 'lowStock', key: 'list', zone: 'side', span: 6, permission: INVENTORY_PERMS, supported: true, title: 'Low Stock Items' },
    { id: 'recentOrders', source: 'recentOrders', key: 'list', zone: 'side', span: 6, permission: SALES_PERMS, supported: true, title: 'Recent Orders' },
  ],
  alerts: [
    { id: 'lowStockAlert', source: 'lowStock', key: 'metric', zone: 'side', span: 4, permission: INVENTORY_PERMS, supported: true, title: 'Low Stock Alert' },
  ],
  insights: baseInsights,
  bottom: baseBottom,
};

// ─── IT Services ───
const itServicesConfig: IndustryDashboardConfig = {
  industry: 'it-services',
  kpis: [
    { id: 'todayRevenue', source: 'todayRevenue', key: 'metricCurrency', zone: 'hero', span: 3, permission: FINANCE_PERMS, supported: true, title: "Today's Revenue" },
    { id: 'pendingOrders', source: 'pendingOrders', key: 'metric', zone: 'hero', span: 3, permission: SALES_PERMS, supported: true, title: 'Open Tickets' },
    { id: 'completedOrders', source: 'completedOrders', key: 'metric', zone: 'hero', span: 3, permission: SALES_PERMS, supported: true, title: 'Resolved Today' },
    { id: 'newCustomers', source: 'newCustomersThisMonth', key: 'metric', zone: 'hero', span: 3, permission: CUSTOMER_PERMS, supported: true, title: 'New Clients' },
  ],
  charts: [
    ...baseFinance,
  ],
  secondary: [
    { id: 'recentOrders', source: 'recentOrders', key: 'list', zone: 'side', span: 6, permission: SALES_PERMS, supported: true, title: 'Recent Orders' },
    { id: 'lowStock', source: 'lowStock', key: 'list', zone: 'side', span: 6, permission: INVENTORY_PERMS, supported: true, title: 'Low Stock Items' },
  ],
  alerts: [],
  insights: baseInsights,
  bottom: baseBottom,
};

// ─── General (fallback) ───
const generalConfig: IndustryDashboardConfig = {
  industry: 'general',
  kpis: [
    { id: 'todaySales', source: 'todaySales', key: 'metricCurrency', zone: 'hero', span: 3, permission: SALES_PERMS, supported: true, title: "Today's Sales" },
    { id: 'totalCustomers', source: 'totalCustomers', key: 'metric', zone: 'hero', span: 3, permission: CUSTOMER_PERMS, supported: true, title: 'Customers' },
    { id: 'todayOrders', source: 'todayOrders', key: 'metric', zone: 'hero', span: 3, permission: SALES_PERMS, supported: true, title: 'Orders Today' },
    { id: 'totalEmployees', source: 'totalEmployees', key: 'metric', zone: 'hero', span: 3, permission: EMPLOYEE_PERMS, supported: true, title: 'Employees' },
  ],
  charts: [
    ...baseFinance,
  ],
  secondary: [
    { id: 'lowStock', source: 'lowStock', key: 'list', zone: 'side', span: 6, permission: INVENTORY_PERMS, supported: true, title: 'Low Stock Items' },
    { id: 'recentOrders', source: 'recentOrders', key: 'list', zone: 'side', span: 6, permission: SALES_PERMS, supported: true, title: 'Recent Orders' },
  ],
  alerts: [
    { id: 'lowStockAlert', source: 'lowStock', key: 'metric', zone: 'side', span: 4, permission: INVENTORY_PERMS, supported: true, title: 'Low Stock Alert' },
  ],
  insights: baseInsights,
  bottom: baseBottom,
};

/** All industry configurations keyed by industry identifier. */
export const INDUSTRY_DASHBOARD_CONFIGS: Record<string, IndustryDashboardConfig> = {
  restaurant: restaurantConfig,
  hospital: hospitalConfig,
  manufacturing: manufacturingConfig,
  school: schoolConfig,
  software: softwareConfig,
  retail: retailConfig,
  pharmacy: pharmacyConfig,
  garments: garmentsConfig,
  'it-services': itServicesConfig,
  general: generalConfig,
};

/** Valid industry keys for validation. */
export const VALID_INDUSTRY_KEYS = new Set(Object.keys(INDUSTRY_DASHBOARD_CONFIGS));

/** Valid widget sources that map to real backend data. */
export const VALID_WIDGET_SOURCES = new Set([
  'todaySales',
  'todayOrders',
  'todayRevenue',
  'todayExpenses',
  'pendingOrders',
  'completedOrders',
  'cancelledOrders',
  'averageOrderValue',
  'lowStock',
  'recentOrders',
  'totalCustomers',
  'totalEmployees',
  'pendingLeaves',
  'monthlyPayroll',
  'monthlyRevenue',
  'revenue',
  'cashFlow',
  'activity',
  'aiInsights',
  'quickActions',
  'newCustomersThisMonth',
  'inventoryValue',
]);

/** Get industry config with fallback to general. */
export function getIndustryConfig(industry: string | null): IndustryDashboardConfig {
  if (industry && industry in INDUSTRY_DASHBOARD_CONFIGS) {
    return INDUSTRY_DASHBOARD_CONFIGS[industry];
  }
  return INDUSTRY_DASHBOARD_CONFIGS.general;
}

/** Organization-level dashboard override configuration. */
export interface OrgDashboardOverride {
  /** Widget IDs to explicitly enable (added to industry defaults). */
  enabledWidgets?: string[];
  /** Widget IDs to hide from the dashboard. */
  hiddenWidgets?: string[];
  /** Custom ordering of widget IDs within each zone. */
  widgetOrder?: string[];
  /** KPI widget IDs to show (overrides industry KPIs if set). */
  kpis?: string[];
  /** Chart widget IDs to show (overrides industry charts if set). */
  charts?: string[];
  /** Secondary widget IDs to show (overrides industry secondary if set). */
  secondary?: string[];
  /** Alert widget IDs to show. */
  alerts?: string[];
}
