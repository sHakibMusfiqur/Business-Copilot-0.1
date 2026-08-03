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