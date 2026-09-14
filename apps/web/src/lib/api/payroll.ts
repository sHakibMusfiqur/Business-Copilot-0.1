import { api } from './client';
import { API_ROUTES } from './routes';
import type { Meta } from '@/lib/types';

export type PayrollStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';

export interface PayrollRecord {
  id: string;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  tax: number;
  netSalary: number;
  paymentDate?: string;
  notes?: string;
  status: PayrollStatus;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  createdAt: string;
  updatedAt?: string;
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    email: string;
    department?: {
      id: string;
      name: string;
      code: string;
    };
  };
}

export interface PayrollDetail extends PayrollRecord {
  updatedAt: string;
  employee: PayrollRecord['employee'] & {
    position?: string;
    salary: number;
  };
}

export interface PayrollStats {
  total: number;
  totalNetSalary: number;
  totalBasicSalary: number;
  totalAllowances: number;
  totalDeductions: number;
  totalTax: number;
  byMonth: Array<{
    periodStart: string;
    totalNetSalary: number;
    count: number;
  }>;
}

export type PayrollListMeta = Meta;

export interface PayrollResponse {
  data: PayrollRecord[];
  meta: PayrollListMeta;
}

export type PayrollSortField =
  | 'periodStart'
  | 'periodEnd'
  | 'basicSalary'
  | 'allowances'
  | 'deductions'
  | 'tax'
  | 'netSalary'
  | 'paymentDate'
  | 'createdAt'
  | 'updatedAt';

export interface GetPayrollParams {
  search?: string;
  employeeId?: string;
  periodStart?: string;
  periodEnd?: string;
  page?: number;
  limit?: number;
  sortBy?: PayrollSortField;
  sortOrder?: 'asc' | 'desc';
}

export async function getPayroll(params?: GetPayrollParams, signal?: AbortSignal): Promise<PayrollResponse> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set('search', params.search);
  if (params?.employeeId) searchParams.set('employeeId', params.employeeId);
  if (params?.periodStart) searchParams.set('periodStart', params.periodStart);
  if (params?.periodEnd) searchParams.set('periodEnd', params.periodEnd);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);

  const query = searchParams.toString();
  const url = query ? `${API_ROUTES.PAYROLL.ROOT}?${query}` : API_ROUTES.PAYROLL.ROOT;

  const response = await api.get<PayrollResponse>(url, { signal });
  return response.data;
}

export async function getPayrollRecord(id: string): Promise<PayrollDetail> {
  const response = await api.get<PayrollDetail>(`${API_ROUTES.PAYROLL.ROOT}/${id}`);
  return response.data;
}

export async function getPayrollStats(): Promise<PayrollStats> {
  const response = await api.get<PayrollStats>(API_ROUTES.PAYROLL.STATS);
  return response.data;
}

export interface CreatePayrollData {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  basicSalary: number;
  allowances?: number;
  deductions?: number;
  tax?: number;
  paymentDate?: string;
  notes?: string;
}

export async function createPayroll(data: CreatePayrollData): Promise<PayrollRecord> {
  const response = await api.post<PayrollRecord>(API_ROUTES.PAYROLL.ROOT, data);
  return response.data;
}

export interface UpdatePayrollData {
  basicSalary?: number;
  allowances?: number;
  deductions?: number;
  tax?: number;
  paymentDate?: string;
  notes?: string;
}

export async function updatePayroll(id: string, data: UpdatePayrollData): Promise<PayrollRecord> {
  const response = await api.patch<PayrollRecord>(`${API_ROUTES.PAYROLL.ROOT}/${id}`, data);
  return response.data;
}

export async function deletePayroll(id: string): Promise<void> {
  await api.delete(`${API_ROUTES.PAYROLL.ROOT}/${id}`);
}

export async function submitPayroll(id: string): Promise<PayrollRecord> {
  const response = await api.post<PayrollRecord>(`${API_ROUTES.PAYROLL.ROOT}/${id}/submit`);
  return response.data;
}

export async function approvePayroll(id: string): Promise<PayrollRecord> {
  const response = await api.post<PayrollRecord>(`${API_ROUTES.PAYROLL.ROOT}/${id}/approve`);
  return response.data;
}

export async function rejectPayroll(id: string): Promise<PayrollRecord> {
  const response = await api.post<PayrollRecord>(`${API_ROUTES.PAYROLL.ROOT}/${id}/reject`);
  return response.data;
}

export interface MarkAsPaidData {
  paymentDate?: string;
  notes?: string;
}

export async function markPayrollAsPaid(id: string, data?: MarkAsPaidData): Promise<PayrollRecord> {
  const response = await api.post<PayrollRecord>(`${API_ROUTES.PAYROLL.ROOT}/${id}/pay`, data);
  return response.data;
}
