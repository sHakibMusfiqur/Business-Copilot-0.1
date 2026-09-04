import { api } from './client';
import { API_ROUTES } from './routes';

export interface Department {
  id: string;
  name: string;
  code: string;
  organizationId: string | null;
  managerId: string | null;
  shared: boolean;
}

export async function getDepartments(signal?: AbortSignal) {
  const response = await api.get<Department[]>(API_ROUTES.DEPARTMENTS.ROOT, { signal });
  return response.data;
}

export interface CreateDepartmentData {
  name: string;
  code: string;
  managerId?: string;
}

export async function createDepartment(data: CreateDepartmentData): Promise<Department> {
  const response = await api.post<Department>(API_ROUTES.DEPARTMENTS.ROOT, data);
  return response.data;
}

export interface UpdateDepartmentData {
  name?: string;
  code?: string;
  managerId?: string;
  isActive?: boolean;
}

export async function updateDepartment(id: string, data: UpdateDepartmentData): Promise<Department> {
  const response = await api.patch<Department>(`${API_ROUTES.DEPARTMENTS.ROOT}/${id}`, data);
  return response.data;
}

export async function deleteDepartment(id: string): Promise<void> {
  await api.delete(`${API_ROUTES.DEPARTMENTS.ROOT}/${id}`);
}
