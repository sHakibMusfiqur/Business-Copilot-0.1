import { api } from './client';
import { API_ROUTES } from './routes';

export async function getRoles(signal?: AbortSignal) {
  const response = await api.get(API_ROUTES.ROLES.ROOT, { signal });
  return response.data;
}

export async function getRoleById(id: string, signal?: AbortSignal) {
  const response = await api.get(`${API_ROUTES.ROLES.ROOT}/${id}`, { signal });
  return response.data;
}

export async function getRoleUsers(roleId: string, signal?: AbortSignal) {
  const response = await api.get(`${API_ROUTES.ROLES.ROOT}/${roleId}/users`, { signal });
  return response.data;
}

export async function createRole(data: { name: string; description?: string }) {
  const response = await api.post(API_ROUTES.ROLES.ROOT, data);
  return response.data;
}

export async function deleteRole(id: string) {
  await api.delete(`${API_ROUTES.ROLES.ROOT}/${id}`);
}

export async function getPermissionsGrouped(signal?: AbortSignal) {
  const response = await api.get(API_ROUTES.ROLES.PERMISSIONS_GROUPED, { signal });
  return response.data;
}

export async function getRolePermissions(roleId: string, signal?: AbortSignal) {
  const response = await api.get(`${API_ROUTES.ROLES.ROOT}/${roleId}/permissions`, { signal });
  return response.data;
}

export async function assignPermissions(roleId: string, permissionNames: string[]) {
  const response = await api.put(`${API_ROUTES.ROLES.ROOT}/${roleId}/permissions`, { permissionNames });
  return response.data;
}

export async function getMyPermissions(signal?: AbortSignal) {
  const response = await api.get<string[]>(API_ROUTES.ROLES.PERMISSIONS_ME, { signal });
  return response.data;
}

export async function duplicateRole(id: string, data: { name?: string; copyPermissions?: boolean }) {
  const response = await api.post(`${API_ROUTES.ROLES.ROOT}/${id}/duplicate`, data);
  return response.data;
}

export async function clonePermissions(roleId: string, sourceRoleId: string) {
  const response = await api.put(`${API_ROUTES.ROLES.ROOT}/${roleId}/permissions/clone`, { sourceRoleId });
  return response.data;
}
