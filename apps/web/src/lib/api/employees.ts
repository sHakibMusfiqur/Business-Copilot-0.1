import { api } from './client';
import { API_ROUTES } from './routes';

export interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  gender?: string;
  hireDate: string;
  departmentId?: string;
  position?: string;
  salary?: number;
  isActive: boolean;
  createdAt: string;
  userId?: string;
  department?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface EmployeeDetail extends Employee {
  dateOfBirth?: string;
  updatedAt: string;
  leaves?: Array<{
    id: string;
    startDate: string;
    endDate: string;
    type: string;
    status: string;
    reason?: string;
    createdAt: string;
  }>;
  payrolls?: Array<{
    id: string;
    periodStart: string;
    periodEnd: string;
    basicSalary: number;
    allowances: number;
    deductions: number;
    tax: number;
    netSalary: number;
    paymentDate?: string;
  }>;
}

export interface EmployeeStats {
  total: number;
  active: number;
  inactive: number;
  byDepartment: Array<{
    departmentId: string | null;
    count: number;
  }>;
}

export type EmployeesResponse = Employee[];

export interface GetEmployeesParams {
  search?: string;
  departmentId?: string;
  isActive?: boolean;
}

export async function getEmployees(params?: GetEmployeesParams): Promise<EmployeesResponse> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set('search', params.search);
  if (params?.departmentId) searchParams.set('departmentId', params.departmentId);
  if (params?.isActive !== undefined) searchParams.set('isActive', String(params.isActive));

  const query = searchParams.toString();
  const url = query ? `${API_ROUTES.EMPLOYEES.ROOT}?${query}` : API_ROUTES.EMPLOYEES.ROOT;

  const response = await api.get<EmployeesResponse>(url);
  return response.data;
}

export async function getEmployee(id: string): Promise<EmployeeDetail> {
  const response = await api.get<EmployeeDetail>(`${API_ROUTES.EMPLOYEES.ROOT}/${id}`);
  return response.data;
}

export async function getEmployeeStats(): Promise<EmployeeStats> {
  const response = await api.get<EmployeeStats>(API_ROUTES.EMPLOYEES.STATS);
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
