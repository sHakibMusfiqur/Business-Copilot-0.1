import type {
  DashboardOverview,
  DashboardStatistics,
  DashboardTrends,
} from '@/components/dashboard/types';

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export interface WidgetMetric {
  value: number;
  currency?: boolean;
  label: string;
  trend: number;
  trendPositive: boolean;
}

export interface WidgetSeries {
  label: string;
  value: string;
  data: number[];
  color: string;
}

export interface WidgetDistribution {
  label: string;
  value: number;
  color: string;
}

export interface WidgetListRow {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  status?: string;
  tone?: StatusTone;
}

export interface WidgetData {
  accent: string;
  metric?: WidgetMetric;
  series?: WidgetSeries;
  distribution?: WidgetDistribution[];
  rows?: WidgetListRow[];
  health?: { score: number; label: string };
  ai?: string[];
  approvals?: WidgetListRow[];
  calendar?: { day: number; items: string[] }[];
  title?: string;
}

export type WidgetSource =
  | 'todaySales'
  | 'openOrders'
  | 'activeTables'
  | 'averageTicket'
  | 'appointmentsToday'
  | 'admissions'
  | 'bedOccupancy'
  | 'emergencyCases'
  | 'productionOutput'
  | 'machineUtilization'
  | 'workOrders'
  | 'costPerUnit'
  | 'enrolled'
  | 'attendanceToday'
  | 'feesCollected'
  | 'expenditure'
  | 'activeProjects'
  | 'sprintProgress'
  | 'openPRs'
  | 'monthlyRecurringRevenue'
  | 'posSalesToday'
  | 'transactions'
  | 'productsInStock'
  | 'avgOrderValue'
  | 'prescriptionsToday'
  | 'stockValue'
  | 'expiringSoon'
  | 'dailyRevenue'
  | 'orderBook'
  | 'fabricStock'
  | 'pendingDelivery'
  | 'openTickets'
  | 'billableHours'
  | 'monthlyRetainer'
  | 'monthlyRevenue'
  | 'totalCustomers'
  | 'employees'
  | 'lowStock'
  | 'outOfStock'
  | 'pendingApprovals'
  | 'netProfit'
  | 'cashBalance'
  | 'outstanding'
  | 'growth'
  | 'teamSize'
  | 'teamCost'
  | 'totalEmployees'
  | 'pendingLeaves'
  | 'monthlyPayroll'
  | 'openRoles'
  | 'salesToday'
  | 'pipeline'
  | 'targetProgress'
  | 'myTasks'
  | 'hoursToday'
  | 'upcomingEvents'
  | 'organizations'
  | 'activeOrgs'
  | 'platformRevenue'
  | 'users'
  | 'aiTokens'
  | 'revenue'
  | 'sales'
  | 'dailySales'
  | 'appointments'
  | 'production'
  | 'enrollment'
  | 'recurringRevenue'
  | 'orders'
  | 'stockMovement'
  | 'platformGrowth'
  | 'customers'
  | 'menuMix'
  | 'departments'
  | 'quality'
  | 'categorySales'
  | 'deployments'
  | 'departmentLoad'
  | 'kitchenQueue'
  | 'medicineStock'
  | 'machineStatus'
  | 'academicCalendar'
  | 'pullRequests'
  | 'recentOrders'
  | 'supportQueue'
  | 'ordersQueue'
  | 'leaveRequests'
  | 'productionLines'
  | 'healthScore'
  | 'aiInsights'
  | 'activity'
  | 'approvals'
  | 'calendar'
  | 'quickActions'
  | 'salesForecast'
  | 'salesTrend'
  | 'revenueTrend'
  | 'cashFlow'
  | 'forecast';

export const METRIC_LABELS: Record<string, string> = {
  todaySales: 'Today Sales',
  openOrders: 'Open Orders',
  activeTables: 'Active Tables',
  averageTicket: 'Avg. Ticket',
  appointmentsToday: 'Appointments Today',
  admissions: 'Admissions',
  bedOccupancy: 'Bed Occupancy',
  emergencyCases: 'Emergency Cases',
  productionOutput: 'Production Output',
  machineUtilization: 'Machine Utilisation',
  workOrders: 'Work Orders',
  costPerUnit: 'Cost per Unit',
  enrolled: 'Students Enrolled',
  attendanceToday: 'Attendance Today',
  feesCollected: 'Fees Collected',
  expenditure: 'Expenditure',
  activeProjects: 'Active Projects',
  sprintProgress: 'Sprint Progress',
  openPRs: 'Open Pull Requests',
  monthlyRecurringRevenue: 'Monthly Recurring Revenue',
  posSalesToday: 'POS Sales Today',
  transactions: 'Transactions',
  productsInStock: 'Products In Stock',
  avgOrderValue: 'Avg. Order Value',
  prescriptionsToday: 'Prescriptions Today',
  stockValue: 'Stock Value',
  expiringSoon: 'Expiring Soon',
  dailyRevenue: 'Daily Revenue',
  orderBook: 'Order Book',
  fabricStock: 'Fabric Stock',
  pendingDelivery: 'Pending Delivery',
  openTickets: 'Open Tickets',
  billableHours: 'Billable Hours',
  monthlyRetainer: 'Monthly Retainer',
  monthlyRevenue: 'Monthly Revenue',
  totalCustomers: 'Total Customers',
  employees: 'Employees',
  lowStock: 'Low Stock Items',
  outOfStock: 'Out of Stock',
  pendingApprovals: 'Pending Approvals',
  netProfit: 'Net Profit',
  cashBalance: 'Cash Balance',
  outstanding: 'Outstanding',
  growth: 'Growth',
  teamSize: 'Team Size',
  teamCost: 'Team Cost',
  totalEmployees: 'Total Employees',
  pendingLeaves: 'Pending Leaves',
  monthlyPayroll: 'Monthly Payroll',
  openRoles: 'Open Roles',
  salesToday: 'Sales Today',
  pipeline: 'Sales Pipeline',
  targetProgress: 'Target Progress',
  myTasks: 'My Tasks',
  hoursToday: 'Hours Today',
  upcomingEvents: 'Upcoming Events',
  organizations: 'Organizations',
  activeOrgs: 'Active Orgs',
  platformRevenue: 'Platform Revenue',
  users: 'Users',
  aiTokens: 'AI Tokens',
};

const TREND_SERIES: Record<string, string[]> = {
  revenue: ['revenue'],
  sales: ['sales'],
  dailySales: ['dailySales'],
  appointments: ['appointments'],
  production: ['production'],
  enrollment: ['enrollment'],
  recurringRevenue: ['recurringRevenue'],
  orders: ['orders'],
  stockMovement: ['stockMovement'],
  platformGrowth: ['platformGrowth'],
  monthlyRevenue: ['revenue'],
};

const TREND_TITLES: Record<string, string> = {
  revenue: 'Revenue Trend',
  sales: 'Sales Trend',
  dailySales: 'Sales Trend',
  appointments: 'Appointments Trend',
  production: 'Production Trend',
  enrollment: 'Enrollment Trend',
  recurringRevenue: 'Recurring Revenue',
  orders: 'Orders Trend',
  stockMovement: 'Stock Movement',
  platformGrowth: 'Platform Growth',
  monthlyRevenue: 'Revenue Trend',
  cashFlow: 'Cash Flow',
  revenueTrend: 'Revenue Trend',
  salesTrend: 'Sales Trend',
  forecast: 'Revenue Forecast',
};

function seriesLabel(source: string): string {
  return METRIC_LABELS[source] ?? 'Trend';
}

function metricOf(stats: DashboardStatistics, source: string): WidgetMetric {
  const revenue = stats.monthlyRevenue;
  const expense = stats.monthlyExpense;
  const netProfit = revenue - expense;

  const valueMap: Record<string, number> = {
    todaySales: revenue,
    openOrders: stats.totalSalesOrders,
    activeTables: Math.max(2, Math.round(stats.totalCustomers / 14)),
    averageTicket: revenue > 0 ? Math.max(1, Math.round(revenue / Math.max(stats.totalSalesOrders, 1))) : 0,
    appointmentsToday: stats.totalCustomers,
    admissions: Math.max(0, Math.round(stats.totalCustomers * 0.18)),
    bedOccupancy: Math.max(0, Math.round(stats.totalEmployees * 0.9)),
    emergencyCases: Math.max(0, Math.round(stats.totalCustomers * 0.05)),
    productionOutput: stats.totalProducts,
    machineUtilization: Math.min(100, Math.round(58 + (stats.totalSalesOrders % 30))),
    workOrders: stats.totalPurchaseOrders,
    costPerUnit: expense > 0 ? Math.max(1, Math.round(expense / Math.max(stats.totalProducts, 1))) : 0,
    enrolled: stats.totalCustomers,
    attendanceToday: Math.max(0, Math.round(stats.totalCustomers * 0.92)),
    feesCollected: revenue,
    expenditure: expense,
    activeProjects: Math.max(1, Math.round(stats.totalCustomers * 0.2)),
    sprintProgress: Math.min(100, Math.round(40 + (stats.totalInvoices % 50))),
    openPRs: Math.max(0, Math.round(stats.totalSalesOrders * 0.7)),
    monthlyRecurringRevenue: revenue,
    posSalesToday: revenue,
    transactions: stats.totalSalesOrders,
    productsInStock: stats.totalProducts,
    avgOrderValue: revenue > 0 ? Math.max(1, Math.round(revenue / Math.max(stats.totalSalesOrders, 1))) : 0,
    prescriptionsToday: stats.totalCustomers,
    stockValue: expense,
    expiringSoon: Math.max(0, Math.round(stats.totalProducts * 0.06)),
    dailyRevenue: revenue,
    orderBook: stats.totalSalesOrders,
    fabricStock: stats.totalProducts,
    pendingDelivery: Math.max(0, Math.round(stats.totalSalesOrders * 0.3)),
    openTickets: Math.max(0, Math.round(stats.totalCustomers * 0.04)),
    billableHours: stats.totalEmployees * 6,
    monthlyRetainer: revenue,
    monthlyRevenue: revenue,
    totalCustomers: stats.totalCustomers,
    employees: stats.totalEmployees,
    lowStock: stats.lowStockProducts,
    outOfStock: Math.max(0, Math.round(stats.lowStockProducts * 0.35)),
    pendingApprovals: stats.pendingLeaves + Math.max(0, stats.totalPurchaseOrders > 0 ? 1 : 0),
    netProfit,
    cashBalance: netProfit,
    outstanding: stats.totalInvoices,
    growth: revenue > 0 ? Math.round((netProfit / revenue) * 100) : 0,
    teamSize: stats.totalUsers,
    teamCost: stats.monthlyPayroll,
    totalEmployees: stats.totalEmployees,
    pendingLeaves: stats.pendingLeaves,
    monthlyPayroll: stats.monthlyPayroll,
    openRoles: Math.max(0, Math.round(stats.totalEmployees * 0.08)),
    salesToday: revenue,
    pipeline: stats.totalSalesOrders,
    targetProgress: Math.min(100, Math.round((stats.totalSalesOrders % 60) + 40)),
    myTasks: Math.max(1, Math.round(stats.totalUsers * 2)),
    hoursToday: Math.max(1, Math.round(stats.totalUsers * 5)),
    upcomingEvents: Math.max(0, Math.round(stats.totalEmployees * 0.1)),
    organizations: 1,
    activeOrgs: 1,
    platformRevenue: revenue,
    users: stats.totalUsers,
    aiTokens: 0,
  };

  const value = valueMap[source] ?? 0;
  const currency = [
    'averageTicket',
    'costPerUnit',
    'monthlyRecurringRevenue',
    'avgOrderValue',
    'dailyRevenue',
    'monthlyRetainer',
    'monthlyRevenue',
    'netProfit',
    'cashBalance',
    'outstanding',
    'teamCost',
    'monthlyPayroll',
    'feesCollected',
    'expenditure',
    'stockValue',
    'platformRevenue',
    'aiTokens',
  ].includes(source);

  const trend = 4 + ((Math.abs(value) + (source.length * 7)) % 14);
  const negative = ['expenditure', 'outOfStock', 'expiringSoon', 'openTickets'].includes(source);

  return {
    value,
    currency,
    label: METRIC_LABELS[source] ?? 'Value',
    trend: negative ? -trend : trend,
    trendPositive: !negative && value >= 0,
  };
}

function seriesOf(_stats: DashboardStatistics, source: string, trends?: DashboardTrends): WidgetSeries {
  const real = trends ? realSeriesOf(trends, source) : undefined;
  if (real) return real;

  // No backend time-series for this source (e.g. empty org, or trend data not
  // available). Render a flat, zero series rather than fabricating trend data.
  const data = Array.from({ length: 12 }, () => 0);
  return {
    label: seriesLabel(source),
    value: '$0',
    data,
    color: '#3B82F6',
  };
}

/** Resolves a trend series from real backend time-series when it is available. */
function realSeriesOf(trends: DashboardTrends, source: string): WidgetSeries | undefined {
  const series: Record<string, number[] | undefined> = {
    revenue: trends.revenue,
    expenses: trends.expenses,
    sales: trends.sales,
    cashFlow: trends.cashFlow,
  };
  const data = series[source];
  if (!data || data.length === 0) return undefined;
  const total = data.reduce((a, b) => a + b, 0);
  return {
    label: seriesLabel(source),
    value: `$${Math.round(total / data.length).toLocaleString('en-US')}`,
    data,
    color: '#3B82F6',
  };
}

const DISTRIBUTION_COLORS = ['#3B82F6', '#8B5CF6', '#06B6D4', '#F59E0B', '#22C55E', '#F43F5E'];

function distributionOf(stats: DashboardStatistics, source: string): WidgetDistribution[] {
  // Only present real, countable data. The backend does not expose per-category
  // breakdowns for these chart types, so fabricating split ratios would present
  // fake business data. Show a single truthful segment when a real count exists,
  // otherwise return an empty distribution.
  const segments: { label: string; value: number }[] = [];
  if (source === 'customers' && stats.totalCustomers > 0) {
    segments.push({ label: 'Customers', value: stats.totalCustomers });
  } else if ((source === 'departments' || source === 'departmentLoad') && stats.totalEmployees > 0) {
    segments.push({ label: 'Employees', value: stats.totalEmployees });
  } else if (source === 'categorySales' && stats.totalProducts > 0) {
    segments.push({ label: 'Products', value: stats.totalProducts });
  }
  return segments.map((s, i) => ({
    ...s,
    color: DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length],
  }));
}

function rowsOf(_stats: DashboardStatistics, overview: DashboardOverview, source: string): WidgetListRow[] {
  const activities = overview.recentActivities ?? [];
  const fromActivity = (offset: number, index: number): WidgetListRow | null => {
    const a = activities[index + offset];
    if (!a) return null;
    return {
      id: a.id,
      title: a.action,
      subtitle: a.entity,
      meta: a.user?.name ?? 'System',
      status: a.entity.toLowerCase().includes('invoice') ? 'Paid' : 'Pending',
      tone: a.entity.toLowerCase().includes('invoice') ? 'success' : 'warning',
    };
  };

  const rows: Record<string, WidgetListRow[]> = {
    // No backend list data exists for these sources; avoid fabricating SKUs,
    // employees, tables, machines or PRs. Render as empty (real data only).
    lowStock: [],
    recentOrders: activities.slice(0, 5).map((a) => ({
      id: a.id,
      title: a.action,
      subtitle: a.entity,
      meta: a.user?.name ?? 'System',
      status: 'Pending',
      tone: 'warning' as StatusTone,
    })),
    leaveRequests: [],
    ordersQueue: [
      fromActivity(0, 0),
      fromActivity(1, 1),
      fromActivity(2, 2),
    ].filter(Boolean) as WidgetListRow[],
    supportQueue: [
      fromActivity(0, 0),
      fromActivity(1, 1),
      fromActivity(2, 2),
    ].filter(Boolean) as WidgetListRow[],
    openTickets: [
      fromActivity(0, 0),
      fromActivity(1, 1),
    ].filter(Boolean) as WidgetListRow[],
    kitchenQueue: [],
    medicineStock: [],
    machineStatus: [],
    academicCalendar: [],
    pullRequests: [],
    productionLines: [],
  };

  const fallback = activities.length > 0
    ? activities.slice(0, 5).map((a) => ({
        id: a.id,
        title: a.action,
        subtitle: a.entity,
        meta: a.user?.name ?? 'System',
        status: 'Info',
        tone: 'neutral' as StatusTone,
      }))
    : [fromActivity(0, 0)].filter(Boolean) as WidgetListRow[];

  return rows[source] ?? fallback;
}

function healthOf(stats: DashboardStatistics): { score: number; label: string } {
  let score = 78;
  if (stats.lowStockProducts > 0) score -= Math.min(18, stats.lowStockProducts * 2);
  if (stats.pendingLeaves > 2) score -= 4;
  if (stats.monthlyRevenue < stats.monthlyExpense) score -= 14;
  score = Math.max(38, Math.min(98, score));
  return {
    score,
    label: score >= 85 ? 'Excellent' : score >= 65 ? 'Good' : 'Needs attention',
  };
}

function approvalsOf(stats: DashboardStatistics): WidgetListRow[] {
  const rows: WidgetListRow[] = [];
  // Only surface pending counts that exist; do not invent specific employees,
  // purchase orders or invoice references that are not backed by real data.
  if (stats.pendingLeaves > 0) {
    rows.push({
      id: 'ap-leave',
      title: 'Leave request',
      subtitle: 'Awaiting approval',
      meta: `${stats.pendingLeaves} pending`,
      status: 'Approve',
      tone: 'warning',
    });
  }
  if (stats.totalPurchaseOrders > 0) {
    rows.push({
      id: 'ap-po',
      title: 'Purchase order',
      subtitle: 'Awaiting sign-off',
      meta: `${stats.totalPurchaseOrders} open`,
      status: 'Approve',
      tone: 'warning',
    });
  }
  if (stats.totalInvoices > 0) {
    rows.push({
      id: 'ap-inv',
      title: 'Invoice approval',
      subtitle: 'Awaiting sign-off',
      meta: `${stats.totalInvoices} open`,
      status: 'Approve',
      tone: 'warning',
    });
  }
  return rows;
}

function aiOf(overview: DashboardOverview): string[] {
  const insights = overview.aiInsights ?? [];
  return insights.map((i) => i.text);
}

function calendarOf(): { day: number; items: string[] }[] {
  // No backend scheduling data; an empty calendar is honest rather than
  // presenting invented payroll/vendor/payment events.
  return [];
}

/**
 * Resolves a widget `source` against the live dashboard overview into a typed
 * payload the widget components can render without domain knowledge.
 */
export function resolveWidgetData(
  source: string | undefined,
  overview: DashboardOverview | null,
  accent: string,
): WidgetData {
  const stats = overview?.statistics ?? emptyStatistics();
  const key = (source ?? 'metric') as WidgetSource;
  const base: WidgetData = { accent };

  if (key === 'healthScore') {
    return { ...base, health: healthOf(stats), title: 'Business Health' };
  }
  if (key === 'aiInsights') {
    return { ...base, ai: overview ? aiOf(overview) : [], title: "Today's AI Insights" };
  }
  if (key === 'activity') {
    return { ...base, rows: rowsOf(stats, overview ?? emptyOverview(), 'recentOrders'), title: 'Activity' };
  }
  if (key === 'approvals') {
    return { ...base, approvals: approvalsOf(stats), title: 'Awaiting Approval' };
  }
  if (key === 'calendar') {
    return { ...base, calendar: calendarOf(), title: 'Upcoming' };
  }
  if (key === 'quickActions') {
    return { ...base, title: 'Quick Actions' };
  }
  if (TREND_SERIES[key] || key === 'forecast' || key === 'revenueTrend' || key === 'salesTrend' || key === 'cashFlow') {
    const seriesSource =
      key === 'revenueTrend' ? 'revenue' : key === 'salesTrend' ? 'sales' : key === 'cashFlow' ? 'cashFlow' : key;
    return {
      ...base,
      series: seriesOf(stats, seriesSource, overview?.trends),
      title: TREND_TITLES[key] ?? `${seriesLabel(key)} Trend`,
    };
  }
  if (key in METRIC_LABELS) {
    return { ...base, metric: metricOf(stats, key), title: METRIC_LABELS[key] };
  }
  if (
    ['customers', 'menuMix', 'departments', 'quality', 'categorySales', 'deployments', 'departmentLoad'].includes(key)
  ) {
    return { ...base, distribution: distributionOf(stats, key), title: key };
  }
  if (
    ['lowStock', 'recentOrders', 'ordersQueue', 'supportQueue', 'openTickets', 'kitchenQueue', 'medicineStock', 'machineStatus', 'academicCalendar', 'pullRequests', 'productionLines', 'leaveRequests'].includes(key)
  ) {
    return { ...base, rows: rowsOf(stats, overview ?? emptyOverview(), key), title: METRIC_LABELS[key] ?? key };
  }
  return { ...base, metric: metricOf(stats, 'monthlyRevenue'), title: 'Monthly Revenue' };
}

export function emptyStatistics(): DashboardStatistics {
  return {
    totalUsers: 0,
    totalCustomers: 0,
    totalProducts: 0,
    totalSuppliers: 0,
    totalInvoices: 0,
    totalPurchaseOrders: 0,
    totalSalesOrders: 0,
    lowStockProducts: 0,
    monthlyRevenue: 0,
    monthlyExpense: 0,
    totalEmployees: 0,
    pendingLeaves: 0,
    monthlyPayroll: 0,
  };
}

function emptyOverview(): DashboardOverview {
  return {
    organization: { id: '', name: '', logo: null, createdAt: '' },
    statistics: emptyStatistics(),
    trends: { labels: [], revenue: [], expenses: [], sales: [], cashFlow: [] },
    quickActions: [],
    recentActivities: [],
    permissions: [],
    layout: { kpis: [], charts: [], secondary: [], alerts: [], activity: false, aiCopilot: true },
    aiInsights: [],
  };
}
