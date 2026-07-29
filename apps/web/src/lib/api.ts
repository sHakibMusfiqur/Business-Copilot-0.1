import axios, {
  type AxiosInstance,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';

import type { SaleListResponse, Sale } from '@/components/sales/sales-types';

import { useAuthStore } from '@/store/auth-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface OrganizationListResponse {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  logo: string | null;
  isActive: boolean;
  suspendedAt: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  deletedReason: string | null;
  archivedAt: string | null;
  archivedBy: string | null;
  archiveReason: string | null;
  createdAt: string;
  updatedAt: string;
  userCount: number;
  memberCount: number;
  owner: { id: string; name: string; email: string } | null;
  plan: { name: string; slug: string } | null;
  subscriptionStatus: string | null;
}

export interface UserListResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  avatar: string | null;
  organizationId: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  organization: { id: string; name: string } | null;
  memberOf: { role: string }[];
}

export interface AuditLogResponse {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  status: string;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
  organization: { id: string; name: string } | null;
}

export interface SubscriptionPlanResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  currency: string;
  interval: string;
  maxUsers: number;
  maxCustomers: number;
  maxProducts: number;
  maxStorage: number;
  isActive: boolean;
  features: Record<string, boolean> | null;
}

export interface DashboardResponse {
  organizations: {
    total: number;
    active: number;
    suspended: number;
    archived: number;
    deleted: number;
    newToday: number;
    newThisWeek: number;
    newThisMonth: number;
  };
  users: {
    total: number;
    dailyActive: number;
    monthlyActive: number;
    growthRate: number;
  };
  subscriptions: {
    trialing: number;
    active: number;
    expired: number;
    cancelled: number;
    topPlans: { name: string; count: number }[];
  };
  revenue: {
    today: number;
    thisMonth: number;
    lifetime: number;
  };
  topOrganizations: { id: string; name: string; userCount: number; revenue: number }[];
  platform: {
    version: string;
    uptimeMs: number;
  };
  recentActivities: { id: string; action: string; createdAt: string; user: { name: string; email: string } | null }[];
  recentErrors: { id: string; action: string; createdAt: string; user: { name: string; email: string } | null }[];
}

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 500;
    const data = error.response?.data as Record<string, unknown> | undefined;
    const message =
      (data?.message as string) ??
      (data?.error as string) ??
      error.message ??
      'An unexpected error occurred';
    const code = (data?.code as string) ?? 'UNKNOWN_ERROR';
    return new ApiError(
      typeof message === 'string' ? message : Array.isArray(message) ? message[0] : 'An unexpected error occurred',
      status,
      code,
    );
  }
  if (error instanceof Error) {
    return new ApiError(error.message, 500);
  }
  return new ApiError('An unexpected error occurred', 500);
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
  const token = getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const normalized = normalizeError(error);

    if (normalized.status === 401) {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };

      if (!originalRequest._retry) {
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
          return Promise.reject(normalized);
        }
      }
    }

    return Promise.reject(normalized);
  },
);

export async function refreshAccessToken(): Promise<string | null> {
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
  } catch {
    // ignore server errors during logout
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

// ─── Platform Admin ──────────────────────────────────────────────

export async function getAdminDashboard() {
  const response = await api.get('/admin/dashboard');
  return response.data;
}

export async function getAdminOrganizations(page = 1, limit = 20, search?: string, status?: string) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  const response = await api.get(`/admin/organizations?${params}`);
  return response.data;
}

export async function getAdminOrganization(id: string) {
  const response = await api.get(`/admin/organizations/${id}`);
  return response.data;
}

export async function createAdminOrganization(data: {
  name: string;
  ownerEmail: string;
  ownerName: string;
  ownerPassword: string;
  planSlug?: string;
}) {
  const response = await api.post('/admin/organizations', data);
  return response.data;
}

export async function updateAdminOrganization(id: string, data: Record<string, unknown>) {
  const response = await api.patch(`/admin/organizations/${id}`, data);
  return response.data;
}

export async function suspendOrganization(id: string) {
  const response = await api.patch(`/admin/organizations/${id}/suspend`);
  return response.data;
}

export async function activateOrganization(id: string) {
  const response = await api.patch(`/admin/organizations/${id}/activate`);
  return response.data;
}

export async function deleteAdminOrganization(id: string) {
  const response = await api.delete(`/admin/organizations/${id}`);
  return response.data;
}

export async function transferOwnership(id: string, newOwnerUserId: string) {
  const response = await api.patch(`/admin/organizations/${id}/transfer`, { newOwnerUserId });
  return response.data;
}

export async function getAdminUsers(page = 1, limit = 20, search?: string, organizationId?: string, role?: string) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);
  if (organizationId) params.set('organizationId', organizationId);
  if (role) params.set('role', role);
  const response = await api.get(`/admin/users?${params}`);
  return response.data;
}

export async function getAdminAuditLogs(page = 1, limit = 20, search?: string, action?: string) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);
  if (action) params.set('action', action);
  const response = await api.get(`/admin/audit?${params}`);
  return response.data;
}

export async function getAdminAuditActions() {
  const response = await api.get('/admin/audit/actions');
  return response.data;
}

export async function getAdminSettings() {
  const response = await api.get('/admin/settings');
  return response.data;
}

export async function updateAdminSetting(key: string, value: unknown) {
  const response = await api.patch('/admin/settings', { key, value });
  return response.data;
}

export async function getAdminPlans() {
  const response = await api.get('/admin/plans');
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

// ─── Product Management ─────────────────────────────────────────

export interface ProductListParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  categoryId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getProducts(params?: ProductListParams) {
  const response = await api.get('/products', { params });
  return response.data;
}

export async function getProductById(id: string) {
  const response = await api.get(`/products/${id}`);
  return response.data;
}

export async function createProduct(data: {
  name: string;
  sku: string;
  barcode?: string;
  brand?: string;
  description?: string;
  categoryId?: string;
  supplierId?: string;
  costPrice?: number;
  unitPrice?: number;
  unit?: string;
  taxRate?: number;
  minimumStock?: number;
  maximumStock?: number;
  imageUrl?: string;
  isActive?: boolean;
}) {
  const response = await api.post('/products', data);
  return response.data;
}

export async function updateProduct(
  id: string,
  data: {
    name?: string;
    sku?: string;
    barcode?: string;
    brand?: string;
    description?: string;
    categoryId?: string;
    supplierId?: string;
    costPrice?: number;
    unitPrice?: number;
    unit?: string;
    taxRate?: number;
    minimumStock?: number;
    maximumStock?: number;
    imageUrl?: string;
    isActive?: boolean;
  },
) {
  const response = await api.patch(`/products/${id}`, data);
  return response.data;
}

export async function deleteProduct(id: string) {
  const response = await api.delete(`/products/${id}`);
  return response.data;
}

export async function updateProductStatus(id: string, isActive: boolean) {
  const response = await api.patch(`/products/${id}/status`, { isActive });
  return response.data;
}

export async function getCategories() {
  const response = await api.get('/categories');
  return response.data;
}

// ─── Inventory Management ───────────────────────────────────────

export interface InventoryListParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  lowStock?: boolean;
  outOfStock?: boolean;
  categoryId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getInventory(params?: InventoryListParams) {
  const response = await api.get('/inventory', { params });
  return response.data;
}

export async function adjustStock(data: {
  productId: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  notes?: string;
}) {
  const response = await api.post('/inventory/adjust', data);
  return response.data;
}

export async function getInventoryHistory(productId: string) {
  const response = await api.get(`/inventory/${productId}/history`);
  return response.data;
}

export async function getInventorySummary() {
  const response = await api.get('/inventory/summary');
  return response.data;
}

// ─── Purchase Management ────────────────────────────────────────

export interface PurchaseListParams {
  page?: number;
  limit?: number;
  search?: string;
  supplierId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getPurchases(params?: PurchaseListParams) {
  const response = await api.get('/purchase', { params });
  return response.data;
}

export async function getPurchaseById(id: string) {
  const response = await api.get(`/purchase/${id}`);
  return response.data;
}

export async function createPurchase(data: {
  supplierId: string;
  notes?: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitCost: number;
    discount?: number;
    tax?: number;
  }>;
}) {
  const response = await api.post('/purchase', data);
  return response.data;
}

export async function updatePurchase(
  id: string,
  data: {
    supplierId?: string;
    notes?: string;
    items?: Array<{
      productId: string;
      quantity: number;
      unitCost: number;
      discount?: number;
      tax?: number;
    }>;
  },
) {
  const response = await api.patch(`/purchase/${id}`, data);
  return response.data;
}

export async function approvePurchase(id: string) {
  const response = await api.post(`/purchase/${id}/approve`);
  return response.data;
}

export async function receivePurchase(id: string, notes?: string) {
  const response = await api.post(`/purchase/${id}/receive`, { notes });
  return response.data;
}

export async function deletePurchase(id: string) {
  const response = await api.delete(`/purchase/${id}`);
  return response.data;
}

// ─── Sales Management ───────────────────────────────────────────

export interface SalesListParams {
  page?: number;
  limit?: number;
  search?: string;
  customerId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getSales(params?: SalesListParams): Promise<SaleListResponse> {
  const response = await api.get('/sales', { params });
  return response.data;
}

export async function getSaleById(id: string): Promise<Sale> {
  const response = await api.get(`/sales/${id}`);
  return response.data;
}

export async function createSale(
  data: {
    customerId: string;
    notes?: string;
    items: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      discount?: number;
      tax?: number;
    }>;
  },
): Promise<{ id: string; orderNumber: string; status: string; total: number; createdAt: string }> {
  const response = await api.post('/sales', data);
  return response.data;
}

export async function updateSale(
  id: string,
  data: {
    customerId?: string;
    notes?: string;
    items?: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      discount?: number;
      tax?: number;
    }>;
  },
): Promise<{ id: string; message: string } | { id: string; orderNumber: string; status: string; total: number; updatedAt: string }> {
  const response = await api.patch(`/sales/${id}`, data);
  return response.data;
}

export async function confirmSale(id: string): Promise<{ id: string; orderNumber: string; status: string }> {
  const response = await api.post(`/sales/${id}/confirm`);
  return response.data;
}

export async function deliverSale(id: string, notes?: string): Promise<{ id: string; orderNumber: string; status: string; updatedAt: string }> {
  const response = await api.post(`/sales/${id}/deliver`, { notes });
  return response.data;
}

export async function deleteSale(id: string): Promise<{ message: string }> {
  const response = await api.delete(`/sales/${id}`);
  return response.data;
}

// ─── Accounting & Finance ──────────────────────────────────────

export interface AccountListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getAccountSummary() {
  const response = await api.get('/accounting/summary');
  return response.data;
}

export async function getAccounts(params?: AccountListParams) {
  const response = await api.get('/accounting/accounts', { params });
  return response.data;
}

export async function getAccountById(id: string) {
  const response = await api.get(`/accounting/accounts/${id}`);
  return response.data;
}

export async function createAccount(data: {
  code: string;
  name: string;
  type: string;
  parentId?: string;
  description?: string;
}) {
  const response = await api.post('/accounting/accounts', data);
  return response.data;
}

export async function updateAccount(
  id: string,
  data: {
    code?: string;
    name?: string;
    type?: string;
    parentId?: string;
    description?: string;
    isActive?: boolean;
  },
) {
  const response = await api.patch(`/accounting/accounts/${id}`, data);
  return response.data;
}

export async function deleteAccount(id: string) {
  const response = await api.delete(`/accounting/accounts/${id}`);
  return response.data;
}

export interface JournalEntryListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getJournalEntries(params?: JournalEntryListParams) {
  const response = await api.get('/accounting/journal', { params });
  return response.data;
}

export async function getJournalEntryById(id: string) {
  const response = await api.get(`/accounting/journal/${id}`);
  return response.data;
}

export async function createJournalEntry(data: {
  description: string;
  referenceId?: string;
  referenceType?: string;
  lines: Array<{
    accountId: string;
    debit: number;
    credit: number;
    description?: string;
  }>;
}) {
  const response = await api.post('/accounting/journal', data);
  return response.data;
}

export async function updateJournalEntry(
  id: string,
  data: {
    description?: string;
    lines?: Array<{
      accountId: string;
      debit: number;
      credit: number;
      description?: string;
    }>;
  },
) {
  const response = await api.patch(`/accounting/journal/${id}`, data);
  return response.data;
}

export async function postJournalEntry(id: string) {
  const response = await api.post(`/accounting/journal/${id}/post`);
  return response.data;
}

export async function deleteJournalEntry(id: string) {
  const response = await api.delete(`/accounting/journal/${id}`);
  return response.data;
}

export async function getReceivables(params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}) {
  const response = await api.get('/accounting/receivables', { params });
  return response.data;
}

export async function getPayables(params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}) {
  const response = await api.get('/accounting/payables', { params });
  return response.data;
}

export async function getPayments(params?: {
  page?: number;
  limit?: number;
  type?: string;
}) {
  const response = await api.get('/accounting/payments', { params });
  return response.data;
}

export async function createPayment(data: {
  type: 'CUSTOMER_PAYMENT' | 'SUPPLIER_PAYMENT';
  customerId?: string;
  supplierId?: string;
  amount: number;
  reference?: string;
  notes?: string;
}) {
  const response = await api.post('/accounting/payments', data);
  return response.data;
}

export async function getGeneralLedger(params?: {
  accountId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const response = await api.get('/accounting/ledger', { params });
  return response.data;
}

export async function getTrialBalance() {
  const response = await api.get('/accounting/trial-balance');
  return response.data;
}

// ─── CRM Management ─────────────────────────────────────────────

export interface CrmLeadsListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  assignedToId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getCrmSummary() {
  const response = await api.get('/crm/summary');
  return response.data;
}

export async function getLeads(params?: CrmLeadsListParams) {
  const response = await api.get('/crm/leads', { params });
  return response.data;
}

export async function getLeadById(id: string) {
  const response = await api.get(`/crm/leads/${id}`);
  return response.data;
}

export async function createLead(data: {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  source?: string;
  status?: string;
  estimatedValue?: number;
  assignedToId?: string;
  notes?: string;
}) {
  const response = await api.post('/crm/leads', data);
  return response.data;
}

export async function updateLead(
  id: string,
  data: {
    name?: string;
    company?: string;
    email?: string;
    phone?: string;
    source?: string;
    status?: string;
    estimatedValue?: number;
    assignedToId?: string;
    notes?: string;
  },
) {
  const response = await api.patch(`/crm/leads/${id}`, data);
  return response.data;
}

export async function deleteLead(id: string) {
  const response = await api.delete(`/crm/leads/${id}`);
  return response.data;
}

export async function updateLeadStatus(id: string, status: string) {
  const response = await api.patch(`/crm/leads/${id}/status`, { status });
  return response.data;
}

export async function assignLead(id: string, assignedToId: string | null) {
  const response = await api.patch(`/crm/leads/${id}/assign`, { assignedToId });
  return response.data;
}

export async function getLeadTimeline(id: string) {
  const response = await api.get(`/crm/leads/${id}/timeline`);
  return response.data;
}

export async function getLeadActivities(id: string, params?: { page?: number; limit?: number; completed?: boolean }) {
  const response = await api.get(`/crm/leads/${id}/activities`, { params });
  return response.data;
}

export async function createActivity(
  leadId: string,
  data: {
    type: string;
    title: string;
    description?: string;
    dueDate?: string;
    completed?: boolean;
  },
) {
  const response = await api.post(`/crm/leads/${leadId}/activities`, data);
  return response.data;
}

export async function toggleActivity(id: string) {
  const response = await api.patch(`/crm/activities/${id}/toggle`);
  return response.data;
}

export async function deleteActivity(id: string) {
  const response = await api.delete(`/crm/activities/${id}`);
  return response.data;
}

// ─── Audit Logs ──────────────────────────────────────────

export async function getAuditLogs(params?: {
  page?: number;
  limit?: number;
  search?: string;
  action?: string;
  entity?: string;
  userId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  const response = await api.get('/audit', { params });
  return response.data;
}

export async function getAuditActions() {
  const response = await api.get('/audit/actions');
  return response.data;
}

export function getAuditExportUrl(params?: {
  action?: string;
  entity?: string;
}): string {
  const searchParams = new URLSearchParams();
  if (params?.action) searchParams.set('action', params.action);
  if (params?.entity) searchParams.set('entity', params.entity);
  const query = searchParams.toString();
  return `${API_URL}/api/audit/export${query ? `?${query}` : ''}`;
}
