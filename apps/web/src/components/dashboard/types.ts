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
  lowStockProducts: number;
  monthlyRevenue: number;
  monthlyExpense: number;
}

export interface QuickAction {
  label: string;
  href: string;
  icon: string;
  available: boolean;
}

export interface RecentActivityItem {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  user: { id: string; name: string; email: string } | null;
  createdAt: string;
}

export interface DashboardOverview {
  organization: DashboardOrganization;
  statistics: DashboardStatistics;
  quickActions: QuickAction[];
  recentActivities: RecentActivityItem[];
}
