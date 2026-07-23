import axios, {
  type AxiosInstance,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';

import { useAuthStore } from '@/store/auth-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken && config.headers) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const newToken = await refreshAccessToken();
        if (newToken && originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return api(originalRequest);
      } catch {
        setAccessToken(null);
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await axios.post<TokenResponse>(
        `${API_URL}/api/auth/refresh`,
        {},
        { withCredentials: true },
      );
      const token = response.data.accessToken;
      setAccessToken(token);
      return token;
    } catch {
      setAccessToken(null);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function login(email: string, password: string) {
  const response = await api.post('/auth/login', { email, password });
  const { accessToken: token, user } = response.data;
  setAccessToken(token);
  return { user, accessToken: token };
}

export async function register(name: string, email: string, password: string) {
  const response = await api.post('/auth/register', { name, email, password });
  const { accessToken: token, user } = response.data;
  setAccessToken(token);
  return { user, accessToken: token };
}

export async function logout() {
  try {
    await api.post('/auth/logout');
  } finally {
    setAccessToken(null);
  }
}

export async function getProfile() {
  const response = await api.get('/auth/profile');
  return response.data;
}

export async function getMe() {
  const response = await api.get('/auth/me');
  return response.data;
}

export async function createOrganization(name: string) {
  const response = await api.post('/organizations', { name });
  return response.data;
}

export async function getDashboardOverview() {
  const response = await api.get('/dashboard/overview');
  return response.data;
}

// ─── RBAC ────────────────────────────────────────────────────────

export async function getRoles() {
  const response = await api.get('/roles');
  return response.data;
}

export async function getRoleById(id: string) {
  const response = await api.get(`/roles/${id}`);
  return response.data;
}

export async function createRole(data: { name: string; description?: string }) {
  const response = await api.post('/roles', data);
  return response.data;
}

export async function updateRole(id: string, data: { name?: string; description?: string }) {
  const response = await api.patch(`/roles/${id}`, data);
  return response.data;
}

export async function deleteRole(id: string) {
  await api.delete(`/roles/${id}`);
}

export async function getPermissions() {
  const response = await api.get('/permissions');
  return response.data;
}

export async function getPermissionsGrouped() {
  const response = await api.get('/permissions/grouped');
  return response.data;
}

export async function getRolePermissions(roleId: string) {
  const response = await api.get(`/roles/${roleId}/permissions`);
  return response.data;
}

export async function assignPermissions(roleId: string, permissionNames: string[]) {
  const response = await api.put(`/roles/${roleId}/permissions`, { permissionNames });
  return response.data;
}

export async function getUserRoles(userId: string) {
  const response = await api.get(`/users/${userId}/roles`);
  return response.data;
}

export async function assignUserRoles(userId: string, roleIds: string[]) {
  const response = await api.put(`/users/${userId}/roles`, { roleIds });
  return response.data;
}

export async function getOrganizationUsers() {
  const response = await api.get('/users/assignable');
  return response.data;
}

// ─── User Management ────────────────────────────────────────────

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getUsers(params?: UserListParams) {
  const response = await api.get('/users', { params });
  return response.data;
}

export async function getUserById(id: string) {
  const response = await api.get(`/users/${id}`);
  return response.data;
}

export async function createUser(data: {
  name: string;
  email: string;
  isActive?: boolean;
  role?: string;
  roleIds?: string[];
}) {
  const response = await api.post('/users', data);
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
  const response = await api.patch(`/users/${id}`, data);
  return response.data;
}

export async function deleteUser(id: string) {
  const response = await api.delete(`/users/${id}`);
  return response.data;
}

export async function updateUserStatus(id: string, isActive: boolean) {
  const response = await api.patch(`/users/${id}/status`, { isActive });
  return response.data;
}

// ─── Customer Management ────────────────────────────────────────

export interface CustomerListParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getCustomers(params?: CustomerListParams) {
  const response = await api.get('/customers', { params });
  return response.data;
}

export async function getCustomerById(id: string) {
  const response = await api.get(`/customers/${id}`);
  return response.data;
}

export async function createCustomer(data: {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  taxId?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  notes?: string;
  isActive?: boolean;
}) {
  const response = await api.post('/customers', data);
  return response.data;
}

export async function updateCustomer(
  id: string,
  data: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    taxId?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    notes?: string;
    isActive?: boolean;
  },
) {
  const response = await api.patch(`/customers/${id}`, data);
  return response.data;
}

export async function deleteCustomer(id: string) {
  const response = await api.delete(`/customers/${id}`);
  return response.data;
}

export async function updateCustomerStatus(id: string, isActive: boolean) {
  const response = await api.patch(`/customers/${id}/status`, { isActive });
  return response.data;
}

// ─── Supplier Management ────────────────────────────────────────

export interface SupplierListParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getSuppliers(params?: SupplierListParams) {
  const response = await api.get('/suppliers', { params });
  return response.data;
}

export async function getSupplierById(id: string) {
  const response = await api.get(`/suppliers/${id}`);
  return response.data;
}

export async function createSupplier(data: {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  taxId?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  paymentTerms?: string;
  notes?: string;
  isActive?: boolean;
}) {
  const response = await api.post('/suppliers', data);
  return response.data;
}

export async function updateSupplier(
  id: string,
  data: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    taxId?: string;
    website?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    paymentTerms?: string;
    notes?: string;
    isActive?: boolean;
  },
) {
  const response = await api.patch(`/suppliers/${id}`, data);
  return response.data;
}

export async function deleteSupplier(id: string) {
  const response = await api.delete(`/suppliers/${id}`);
  return response.data;
}

export async function updateSupplierStatus(id: string, isActive: boolean) {
  const response = await api.patch(`/suppliers/${id}/status`, { isActive });
  return response.data;
}
