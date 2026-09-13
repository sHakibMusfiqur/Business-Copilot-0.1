import { api } from './client';
import { API_ROUTES } from './routes';

export type { Department, CreateDepartmentData, UpdateDepartmentData } from '@/components/departments/departments-types';
import type { Department, CreateDepartmentData, UpdateDepartmentData } from '@/components/departments/departments-types';

export async function getDepartments(signal?: AbortSignal) {
  const response = await api.get<Department[]>(API_ROUTES.DEPARTMENTS.ROOT, { signal });
  return response.data;
}

export async function createDepartment(data: CreateDepartmentData): Promise<Department> {
  const response = await api.post<Department>(API_ROUTES.DEPARTMENTS.ROOT, data);
  return response.data;
}

export async function updateDepartment(id: string, data: UpdateDepartmentData): Promise<Department> {
  const response = await api.patch<Department>(`${API_ROUTES.DEPARTMENTS.ROOT}/${id}`, data);
  return response.data;
}

export async function updateDepartmentStatus(id: string, isActive: boolean): Promise<Department> {
  const response = await api.patch<Department>(`${API_ROUTES.DEPARTMENTS.ROOT}/${id}`, { isActive });
  return response.data;
}

export async function deleteDepartment(id: string): Promise<void> {
  await api.delete(`${API_ROUTES.DEPARTMENTS.ROOT}/${id}`);
}
