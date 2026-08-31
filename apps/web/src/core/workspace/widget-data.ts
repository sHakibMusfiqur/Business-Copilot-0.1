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
 
  trend: number | null;
  
  trendPositive: boolean | null;
  /** false when this metric has no real backend data source with matching semantics. */
  available: boolean;
}

export interface WidgetSeries {
  label: string;
  value: string;
  data: number[];
  color: string;
  
  available: boolean;
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
  
  health?: { score: number; label: string; description: string } | null;
  ai?: string[];
  approvals?: WidgetListRow[];
  calendar?: { day: number; items: string[] }[];
  title?: string;
  
  available?: boolean;
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

/** Only sources backed by real backend trend time-series. */
const VALID_TREND_SOURCES = new Set(['revenue', 'sales', 'cashFlow']);

const TREND_TITLES: Record<string, string> = {
  revenue: 'Revenue Trend',
  sales: 'Sales Trend',
  revenueTrend: 'Revenue Trend',
  salesTrend: 'Sales Trend',
  cashFlow: 'Cash Flow',
};

function seriesLabel(source: string): string {
  return METRIC_LABELS[source] ?? 'Trend';
}


function metricOf(stats: DashboardStatistics, source: string): WidgetMetric {
  const revenue = stats.monthlyRevenue;
  const expense = stats.monthlyExpense;
  const netProfit = revenue - expense;

  const CURRENCY_SOURCES = new Set([
    'monthlyRevenue',
    'expenditure',
    'netProfit',
    'teamCost',
    'monthlyPayroll',
  ]);

  // ─── REAL_CONFIRMED: 1:1 mapping to a semantically matching backend field ───
  const confirmed: Record<string, { value: number; currency?: boolean }> = {
    // Revenue / Finance
    monthlyRevenue: { value: revenue, currency: true },
    expenditure: { value: expense, currency: true },
    netProfit: { value: netProfit, currency: true },

    // Entity counts — label matches the entity
    totalCustomers: { value: stats.totalCustomers },
    employees: { value: stats.totalEmployees },
    totalEmployees: { value: stats.totalEmployees },
    lowStock: { value: stats.lowStockProducts },
    pendingLeaves: { value: stats.pendingLeaves },

    // Payroll
    monthlyPayroll: { value: stats.monthlyPayroll, currency: true },
    teamCost: { value: stats.monthlyPayroll, currency: true },

    // Users
    teamSize: { value: stats.totalUsers },
    users: { value: stats.totalUsers },
  };

  const c = confirmed[source];
  if (c) {
    return {
      value: c.value,
      currency: c.currency ?? CURRENCY_SOURCES.has(source),
      label: METRIC_LABELS[source] ?? 'Value',
      trend: null,
      trendPositive: null,
      available: true,
    };
  }

  

  return {
    value: 0,
    currency: CURRENCY_SOURCES.has(source),
    label: METRIC_LABELS[source] ?? 'Value',
    trend: null,
    trendPositive: null,
    available: false,
  };
}


function seriesOf(_stats: DashboardStatistics, source: string, trends?: DashboardTrends): WidgetSeries {
  if (trends && VALID_TREND_SOURCES.has(source)) {
    const seriesMap: Record<string, number[] | undefined> = {
      revenue: trends.revenue,
      sales: trends.sales,
      cashFlow: trends.cashFlow,
    };
    const data = seriesMap[source];
    if (data && data.length > 0 && data.some((d) => d !== 0)) {
      const total = data.reduce((a, b) => a + b, 0);
      return {
        label: seriesLabel(source),
        value: `$${Math.round(total / data.length).toLocaleString('en-US')}`,
        data,
        color: '#3B82F6',
        available: true,
      };
    }
  }

  
  return {
    label: seriesLabel(source),
    value: '—',
    data: [],
    color: '#3B82F6',
    available: false,
  };
}

const DISTRIBUTION_COLORS = ['#3B82F6', '#8B5CF6', '#06B6D4', '#F59E0B', '#22C55E', '#F43F5E'];


function distributionOf(stats: DashboardStatistics, source: string): WidgetDistribution[] {
  const segments: { label: string; value: number }[] = [];

  if (source === 'customers' && stats.totalCustomers > 0) {
    segments.push({ label: 'Customers', value: stats.totalCustomers });
  }
 

  return segments.map((s, i) => ({
    ...s,
    color: DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length],
  }));
}


function rowsOf(_stats: DashboardStatistics, overview: DashboardOverview, source: string): WidgetListRow[] {
  const activities = overview.recentActivities ?? [];

  if (source === 'recentOrders' || source === 'activity') {
    if (activities.length === 0) return [];
    return activities.slice(0, 5).map((a) => ({
      id: a.id,
      title: a.action,
      subtitle: a.entity ?? 'Unknown',
      meta: a.user?.name ?? 'System',
      status: 'Info',
      tone: 'neutral' as StatusTone,
    }));
  }

  
  return [];
}


function healthOf(stats: DashboardStatistics): { score: number; label: string; description: string } | null {
  const hasData =
    stats.totalCustomers > 0 ||
    stats.totalProducts > 0 ||
    stats.totalEmployees > 0 ||
    stats.totalInvoices > 0;

  if (!hasData) return null;

  const signals: string[] = [];
  let score = 100;

  if (stats.lowStockProducts > 0) {
    const deduction = Math.min(20, stats.lowStockProducts * 2);
    score -= deduction;
    signals.push(`${stats.lowStockProducts} low-stock items`);
  }
  if (stats.pendingLeaves > 0) {
    const deduction = Math.min(10, stats.pendingLeaves * 2);
    score -= deduction;
    signals.push(`${stats.pendingLeaves} pending leaves`);
  }
  if (stats.monthlyRevenue > 0 && stats.monthlyRevenue < stats.monthlyExpense) {
    score -= 15;
    signals.push('Expenses exceed revenue');
  }
  score = Math.max(0, Math.min(100, score));

  const label = score >= 85 ? 'Strong' : score >= 65 ? 'Good' : score >= 45 ? 'Fair' : 'Needs attention';
  const description = signals.length > 0
    ? `Signals: ${signals.join(', ')}.`
    : 'No operational issues detected.';

  return { score, label, description };
}


function approvalsOf(stats: DashboardStatistics): WidgetListRow[] {
  const rows: WidgetListRow[] = [];

  if (stats.pendingLeaves > 0) {
    rows.push({
      id: 'ap-leave',
      title: 'Leave request',
      subtitle: 'Awaiting approval',
      meta: `${stats.pendingLeaves} pending`,
      status: 'Review',
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
  return [];
}


export function resolveWidgetData(
  source: string | undefined,
  overview: DashboardOverview | null,
  accent: string,
): WidgetData {
  const stats = overview?.statistics ?? emptyStatistics();
  const key = (source ?? 'metric') as WidgetSource;
  const base: WidgetData = { accent };

  if (key === 'healthScore') {
    const health = healthOf(stats);
    return { ...base, health, title: 'Operational Signals', available: health !== null };
  }
  if (key === 'aiInsights') {
    return { ...base, ai: overview ? aiOf(overview) : [], title: "Today's AI Insights" };
  }
  if (key === 'activity') {
    return { ...base, rows: rowsOf(stats, overview ?? emptyOverview(), 'activity'), title: 'Recent Activity' };
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
  
  if (key === 'revenueTrend' || key === 'salesTrend' || key === 'cashFlow' || VALID_TREND_SOURCES.has(key)) {
    const seriesSource =
      key === 'revenueTrend' ? 'revenue' : key === 'salesTrend' ? 'sales' : key === 'cashFlow' ? 'cashFlow' : key;
    const s = seriesOf(stats, seriesSource, overview?.trends);
    return {
      ...base,
      series: s,
      title: TREND_TITLES[key] ?? `${seriesLabel(key)} Trend`,
      available: s.available,
    };
  }
  if (key === 'forecast') {
    // No forecast algorithm exists. Show unavailable.
    return {
      ...base,
      series: { label: 'Forecast', value: '—', data: [], color: '#3B82F6', available: false },
      title: 'Revenue Forecast',
      available: false,
    };
  }
  if (key in METRIC_LABELS) {
    const m = metricOf(stats, key);
    return { ...base, metric: m, title: METRIC_LABELS[key], available: m.available };
  }
  if (['customers'].includes(key)) {
    return { ...base, distribution: distributionOf(stats, key), title: 'Customers', available: stats.totalCustomers > 0 };
  }
  if (['menuMix', 'departments', 'quality', 'categorySales', 'deployments', 'departmentLoad'].includes(key)) {
    // No per-category breakdown data exists for any of these.
    return { ...base, distribution: [], title: METRIC_LABELS[key] ?? key, available: false };
  }
  if (
    ['lowStock', 'recentOrders', 'ordersQueue', 'supportQueue', 'openTickets', 'kitchenQueue', 'medicineStock', 'machineStatus', 'academicCalendar', 'pullRequests', 'productionLines', 'leaveRequests'].includes(key)
  ) {
    const rows = rowsOf(stats, overview ?? emptyOverview(), key);
    return { ...base, rows, title: METRIC_LABELS[key] ?? key, available: rows.length > 0 };
  }
  // Unknown source: unavailable
  return { ...base, metric: metricOf(stats, 'monthlyRevenue'), title: 'Monthly Revenue', available: false };
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
