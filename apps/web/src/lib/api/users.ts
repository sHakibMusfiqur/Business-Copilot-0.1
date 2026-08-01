import { api } from './client';
import { API_ROUTES } from './routes';

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getUsers(params?: UserListParams, signal?: AbortSignal) {
  const response = await api.get(API_ROUTES.USERS.ROOT, { params, signal });
  return response.data;
}

export async function createUser(data: {
  name: string;
  email: string;
  isActive?: boolean;
  role?: string;
  roleIds?: string[];
}) {
  const response = await api.post(API_ROUTES.USERS.ROOT, data);
  return response.data;
}

export async function updateUser(
  id: string,
  data: {
    name?: string;
    isActive?: boolean;
    role?: string;
    roleIds?: string[];
  },
) {
  const response = await api.patch(`${API_ROUTES.USERS.ROOT}/${id}`, data);
  return response.data;
}

export async function deleteUser(id: string) {
  const response = await api.delete(`${API_ROUTES.USERS.ROOT}/${id}`);
  return response.data;
}

export async function updateUserStatus(id: string, isActive: boolean) {
  const response = await api.patch(`${API_ROUTES.USERS.ROOT}/${id}/status`, { isActive });
  return response.data;
}

export async function getOrganizationUsers(signal?: AbortSignal) {
  const response = await api.get(API_ROUTES.USERS.ASSIGNABLE, { signal });
  return response.data;
}

export async function assignUserRoles(userId: string, roleIds: string[]) {
  const response = await api.put(`${API_ROUTES.USERS.ROOT}/${userId}/roles`, { roleIds });
  return response.data;
}
