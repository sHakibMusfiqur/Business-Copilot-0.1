import { api } from './client';
import { API_ROUTES } from './routes';

export interface SalesSummary {
  totalOrders: number;
  totalRevenue: number;
  byStatus: Array<{
    status: string;
    count: number;
    total: number;
  }>;
}

export interface PurchaseSummary {
  totalOrders: number;
  totalCost: number;
  byStatus: Array<{
    status: string;
    count: number;
    total: number;
  }>;
}

export interface InventorySummary {
  totalProducts: number;
  totalInventoryItems: number;
  totalQuantity: number;
}

export interface AccountingSummary {
  totalAccounts: number;
  totalJournalEntries: number;
  accountsReceivable: number;
  accountsPayable: number;
  netPosition: number;
}

export interface EmployeeSummary {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  byDepartment: Array<{
    departmentId: string | null;
    departmentName: string;
    count: number;
  }>;
  recentHires: Array<{
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    hireDate: string;
    position?: string;
    department?: { name: string };
  }>;
}

export interface ReportsOverview {
  sales: SalesSummary;
  purchases: PurchaseSummary;
  employees: EmployeeSummary;
  generatedAt: string;
}

export async function getReportsOverview(): Promise<ReportsOverview> {
  const response = await api.get<ReportsOverview>(API_ROUTES.REPORTS.OVERVIEW);
  return response.data;
}

export async function getSalesReport(params?: { startDate?: string; endDate?: string }): Promise<SalesSummary> {
  const searchParams = new URLSearchParams();
  if (params?.startDate) searchParams.set('startDate', params.startDate);
  if (params?.endDate) searchParams.set('endDate', params.endDate);

  const query = searchParams.toString();
  const url = query ? `${API_ROUTES.REPORTS.SALES}?${query}` : API_ROUTES.REPORTS.SALES;

  const response = await api.get<SalesSummary>(url);
  return response.data;
}

export async function getPurchaseReport(params?: { startDate?: string; endDate?: string }): Promise<PurchaseSummary> {
  const searchParams = new URLSearchParams();
  if (params?.startDate) searchParams.set('startDate', params.startDate);
  if (params?.endDate) searchParams.set('endDate', params.endDate);

  const query = searchParams.toString();
  const url = query ? `${API_ROUTES.REPORTS.PURCHASES}?${query}` : API_ROUTES.REPORTS.PURCHASES;

  const response = await api.get<PurchaseSummary>(url);
  return response.data;
}

export async function getInventoryReport(): Promise<InventorySummary> {
  const response = await api.get<InventorySummary>(API_ROUTES.REPORTS.INVENTORY);
  return response.data;
}

export async function getAccountingReport(): Promise<AccountingSummary> {
  const response = await api.get<AccountingSummary>(API_ROUTES.REPORTS.ACCOUNTING);
  return response.data;
}

export async function getEmployeeReport(): Promise<EmployeeSummary> {
  const response = await api.get<EmployeeSummary>(API_ROUTES.REPORTS.EMPLOYEES);
  return response.data;
}
