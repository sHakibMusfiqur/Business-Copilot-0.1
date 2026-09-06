export interface DashboardOrganization {
  id: string;
  name: string;
  logo: string | null;
  createdAt: string;
  industry: string | null;
}

export interface IndustryMetrics {
  todaySales: number;
  todayOrders: number;
  todayRevenue: number;
  todayExpenses: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
  lowStockCount: number;
  inventoryValue: number;
  newCustomersThisMonth: number;
  topSellingProducts: Array<{ name: string; quantity: number; revenue: number }>;
  recentOrders: Array<{ id: string; number: string; total: number; status: string; date: string }>;
}

export interface DashboardStatistics {
  totalUsers: number;
  totalCustomers: number;
  totalProducts: number;
  totalSuppliers: number;
  totalInvoices: number;
  totalPurchaseOrders: number;
  totalSalesOrders: number;
  lowStockProducts: number;
  monthlyRevenue: number;
  monthlyExpense: number;
  totalEmployees: number;
  pendingLeaves: number;
  monthlyPayroll: number;
}

export interface QuickAction {
  label: string;
  href: string;
  icon: string;
  available: boolean;
  permission: string;
}

export interface RecentActivityItem {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  user: { id: string; name: string; email: string } | null;
  createdAt: string;
}

export interface DashboardAiInsight {
  id: string;
  icon: string;
  text: string;
}

export interface DashboardTrends {
  labels: string[];
  revenue: number[];
  expenses: number[];
  sales: number[];
  cashFlow: number[];
}

export interface DashboardWidgetConfig {
  id: string;
  source: string;
  key: string;
  zone: string;
  span: number;
  permission?: string[];
  supported: boolean;
  title?: string;
}

export interface DashboardConfig {
  industry: string;
  kpis: DashboardWidgetConfig[];
  charts: DashboardWidgetConfig[];
  secondary: DashboardWidgetConfig[];
  alerts: DashboardWidgetConfig[];
  insights: DashboardWidgetConfig[];
  bottom: DashboardWidgetConfig[];
  allWidgets: DashboardWidgetConfig[];
}

export interface DashboardOverview {
  organization: DashboardOrganization;
  statistics: DashboardStatistics;
  industryMetrics: IndustryMetrics;
  dashboardConfig: DashboardConfig;
  trends: DashboardTrends;
  quickActions: QuickAction[];
  recentActivities: RecentActivityItem[];
  permissions: string[];
  aiInsights: DashboardAiInsight[];
}
