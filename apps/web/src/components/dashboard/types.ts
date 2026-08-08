export interface DashboardOrganization {
  id: string;
  name: string;
  logo: string | null;
  createdAt: string;
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

export type DashboardPanelKey =
  | 'revenue'
  | 'expenses'
  | 'netProfit'
  | 'customers'
  | 'sales'
  | 'employees'
  | 'payroll'
  | 'revenueTrend'
  | 'cashFlow'
  | 'salesTrend'
  | 'invoices'
  | 'products'
  | 'suppliers'
  | 'users'
  | 'pendingLeaves'
  | 'lowStock'
  | 'purchaseOrders';

export interface DashboardLayout {
  kpis: DashboardPanelKey[];
  charts: DashboardPanelKey[];
  secondary: DashboardPanelKey[];
  alerts: DashboardPanelKey[];
  activity: boolean;
  aiCopilot: boolean;
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

export interface DashboardOverview {
  organization: DashboardOrganization;
  statistics: DashboardStatistics;
  trends: DashboardTrends;
  quickActions: QuickAction[];
  recentActivities: RecentActivityItem[];
  permissions: string[];
  layout: DashboardLayout;
  aiInsights: DashboardAiInsight[];
}
