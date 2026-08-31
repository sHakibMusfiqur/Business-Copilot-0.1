import type {
  DashboardOverview,
  DashboardStatistics,
  DashboardTrends,
} from '@/components/dashboard/types';

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export interface OperationalSignal {
  key: string;
  label: string;
  value: number;
}

export interface WidgetMetric {
  /** null when the metric is unavailable. 0 is a valid real zero. */
  value: number | null;
  currency?: boolean;
  label: string;
  /** null when trend data is unavailable. */
  trend: number | null;
  /** null when trend data is unavailable. */
  trendPositive: boolean | null;
  
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
 
  signals?: OperationalSignal[];
  ai?: string[];
  approvals?: WidgetListRow[];
  calendar?: { day: number; items: string[] }[];
  title?: string;
  
  available: boolean;
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

/** Labels for all widget sources. Labels must exactly describe the backend data. */
export const METRIC_LABELS: Record<string, string> = {
  monthlyRevenue: 'Monthly Revenue',
  expenditure: 'Monthly Expenditure',
  netProfit: 'Monthly Net Profit',
  totalCustomers: 'Total Customers',
  employees: 'Employees',
  totalEmployees: 'Total Employees',
  lowStock: 'Low Stock Items',
  pendingLeaves: 'Pending Leave Requests',
  monthlyPayroll: 'Monthly Payroll',
  teamSize: 'Team Size',
  teamCost: 'Monthly Payroll',
  users: 'Users',
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

const UNAVAILABLE_METRIC_BASE = {
  value: null as null,
  trend: null,
  trendPositive: null,
  available: false,
} as const;


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

  const confirmed: Record<string, { value: number; currency?: boolean }> = {
    monthlyRevenue: { value: revenue, currency: true },
    expenditure: { value: expense, currency: true },
    netProfit: { value: netProfit, currency: true },
    totalCustomers: { value: stats.totalCustomers },
    employees: { value: stats.totalEmployees },
    totalEmployees: { value: stats.totalEmployees },
    lowStock: { value: stats.lowStockProducts },
    pendingLeaves: { value: stats.pendingLeaves },
    monthlyPayroll: { value: stats.monthlyPayroll, currency: true },
    teamCost: { value: stats.monthlyPayroll, currency: true },
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

  return { ...UNAVAILABLE_METRIC_BASE, label: METRIC_LABELS[source] ?? 'Value' };
}


function seriesOf(_stats: DashboardStatistics, source: string, trends?: DashboardTrends): WidgetSeries {
  if (trends && VALID_TREND_SOURCES.has(source)) {
    const seriesMap: Record<string, number[] | undefined> = {
      revenue: trends.revenue,
      sales: trends.sales,
      cashFlow: trends.cashFlow,
    };
    const data = seriesMap[source];
    if (data && data.length > 0) {
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

  return { label: seriesLabel(source), value: '—', data: [], color: '#3B82F6', available: false };
}


function rowsOf(_stats: DashboardStatistics, overview: DashboardOverview, source: string): WidgetListRow[] {
  if (source !== 'activity') return [];

  const activities = overview.recentActivities ?? [];
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


function operationalSignals(stats: DashboardStatistics): OperationalSignal[] | null {
  const hasData =
    stats.totalCustomers > 0 ||
    stats.totalProducts > 0 ||
    stats.totalEmployees > 0 ||
    stats.totalInvoices > 0;

  if (!hasData) return null;

  const signals: OperationalSignal[] = [];

  if (stats.lowStockProducts > 0) {
    signals.push({ key: 'lowStock', label: 'Low-stock items', value: stats.lowStockProducts });
  }
  if (stats.pendingLeaves > 0) {
    signals.push({ key: 'pendingLeaves', label: 'Pending leave reviews', value: stats.pendingLeaves });
  }
  if (stats.monthlyRevenue > 0 && stats.monthlyRevenue < stats.monthlyExpense) {
    signals.push({ key: 'revenueVsExpense', label: 'Expenses exceed revenue', value: 1 });
  }

  return signals.length > 0 ? signals : [];
}


function approvalsOf(stats: DashboardStatistics): WidgetListRow[] {
  if (stats.pendingLeaves <= 0) return [];

  return [
    {
      id: 'ap-leave',
      title: 'Leave request',
      subtitle: 'Awaiting review',
      meta: `${stats.pendingLeaves} pending`,
      status: 'Review',
      tone: 'warning',
    },
  ];
}

function aiOf(overview: DashboardOverview): string[] {
  return (overview.aiInsights ?? []).map((i) => i.text);
}

function unavailableMetric(title: string): WidgetData {
  return {
    accent: '',
    metric: { ...UNAVAILABLE_METRIC_BASE, label: title },
    available: false,
  };
}

function unavailableSeries(title: string): WidgetData {
  return {
    accent: '',
    series: { label: title, value: '—', data: [], color: '#3B82F6', available: false },
    available: false,
  };
}

function unavailableDistribution(title: string): WidgetData {
  return {
    accent: '',
    distribution: [],
    title,
    available: false,
  };
}

function unavailableList(title: string): WidgetData {
  return {
    accent: '',
    rows: [],
    title,
    available: false,
  };
}


export function resolveWidgetData(
  source: string | undefined,
  overview: DashboardOverview | null,
  accent: string,
): WidgetData {
  const key = (source ?? 'metric') as WidgetSource;
  const base = { accent };

  // Null/missing overview → everything unavailable (never real zero)
  if (!overview) {
    if (key in METRIC_LABELS) {
      return { ...base, metric: { ...UNAVAILABLE_METRIC_BASE, label: METRIC_LABELS[key] }, available: false };
    }
    return unavailableMetric(key);
  }

  const stats = overview.statistics;

  // ─── Operational signals (no arbitrary score) ───
  if (key === 'healthScore') {
    const signals = operationalSignals(stats);
    return { ...base, signals: signals ?? undefined, title: 'Operational Signals', available: signals !== null && signals.length > 0 };
  }

  // ─── AI insights (backend only) ───
  if (key === 'aiInsights') {
    const ai = aiOf(overview);
    return { ...base, ai, title: "Today's AI Insights", available: true };
  }

  // ─── Activity (audit log only, truthful labels) ───
  if (key === 'activity') {
    const rows = rowsOf(stats, overview, 'activity');
    return { ...base, rows, title: 'Recent Activity', available: true };
  }

  // ─── Approvals (leave requests only) ───
  if (key === 'approvals') {
    const rows = approvalsOf(stats);
    return { ...base, approvals: rows, title: 'Pending Leave Reviews', available: rows.length > 0 };
  }

  // ─── Calendar (no backend source) ───
  if (key === 'calendar') {
    return { ...base, calendar: [], title: 'Upcoming', available: false };
  }

  // ─── Quick actions (commands, not business data) ───
  if (key === 'quickActions') {
    return { ...base, title: 'Quick Actions', available: true };
  }

  // ─── Trends (only real backend sources) ───
  if (key === 'revenueTrend' || key === 'salesTrend' || key === 'cashFlow' || VALID_TREND_SOURCES.has(key)) {
    const seriesSource =
      key === 'revenueTrend' ? 'revenue' : key === 'salesTrend' ? 'sales' : key === 'cashFlow' ? 'cashFlow' : key;
    const s = seriesOf(stats, seriesSource, overview.trends);
    return { ...base, series: s, title: TREND_TITLES[key] ?? `${seriesLabel(key)} Trend`, available: s.available };
  }

  // ─── Forecast (no algorithm exists) ───
  if (key === 'forecast') {
    return unavailableSeries('Revenue Forecast');
  }

  // ─── Metric sources ───
  if (key in METRIC_LABELS) {
    const m = metricOf(stats, key);
    return { ...base, metric: m, title: METRIC_LABELS[key], available: m.available };
  }

  // ─── Distribution sources (no category data exists) ───
  if (['customers', 'menuMix', 'departments', 'quality', 'categorySales', 'deployments', 'departmentLoad'].includes(key)) {
    return unavailableDistribution(METRIC_LABELS[key] ?? key);
  }

  // ─── List sources (only activity uses audit data; all others unavailable) ───
  if (
    ['lowStock', 'recentOrders', 'ordersQueue', 'supportQueue', 'openTickets', 'kitchenQueue', 'medicineStock', 'machineStatus', 'academicCalendar', 'pullRequests', 'productionLines', 'leaveRequests'].includes(key)
  ) {
    return unavailableList(METRIC_LABELS[key] ?? key);
  }

  // ─── Unknown source ───
  return unavailableMetric(key);
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
