import { api } from './client';
import { API_ROUTES } from './routes';

export type { Employee, EmployeeDetail, EmployeeStats, EmployeeListResponse, EmployeeMeta, EmployeeDepartment } from '@/components/employees/employees-types';
import type { Employee, EmployeeDetail, EmployeeStats, EmployeeListResponse } from '@/components/employees/employees-types';

export interface GetEmployeesParams {
  search?: string;
  departmentId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getEmployees(params?: GetEmployeesParams, signal?: AbortSignal): Promise<EmployeeListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set('search', params.search);
  if (params?.departmentId) searchParams.set('departmentId', params.departmentId);
  if (params?.isActive !== undefined) searchParams.set('isActive', String(params.isActive));
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);

  const query = searchParams.toString();
  const url = query ? `${API_ROUTES.EMPLOYEES.ROOT}?${query}` : API_ROUTES.EMPLOYEES.ROOT;

  const response = await api.get<EmployeeListResponse>(url, { signal });
  return response.data;
}

export async function getEmployee(id: string, signal?: AbortSignal): Promise<EmployeeDetail> {
  const response = await api.get<EmployeeDetail>(`${API_ROUTES.EMPLOYEES.ROOT}/${id}`, { signal });
  return response.data;
}

export async function getEmployeeStats(signal?: AbortSignal): Promise<EmployeeStats> {
  const response = await api.get<EmployeeStats>(API_ROUTES.EMPLOYEES.STATS, { signal });
  return response.data;
}

export interface CreateEmployeeData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  hireDate?: string;
  departmentId?: string;
  position?: string;
  salary?: number;
  userId?: string;
}

export async function createEmployee(data: CreateEmployeeData): Promise<Employee> {
  const response = await api.post<Employee>(API_ROUTES.EMPLOYEES.ROOT, data);
  return response.data;
}

export interface UpdateEmployeeData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  gender?: string;
  departmentId?: string;
  position?: string;
  salary?: number;
  isActive?: boolean;
}

export async function updateEmployee(id: string, data: UpdateEmployeeData): Promise<Employee> {
  const response = await api.patch<Employee>(`${API_ROUTES.EMPLOYEES.ROOT}/${id}`, data);
  return response.data;
}

export async function deleteEmployee(id: string): Promise<void> {
  await api.delete(`${API_ROUTES.EMPLOYEES.ROOT}/${id}`);
}

export async function updateEmployeeStatus(id: string, isActive: boolean): Promise<Employee> {
  const response = await api.patch<Employee>(`${API_ROUTES.EMPLOYEES.ROOT}/${id}`, { isActive });
  return response.data;
}
