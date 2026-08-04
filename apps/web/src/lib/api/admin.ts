import { api } from './client';
import { API_ROUTES } from './routes';

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

export async function getAdminDashboard(signal?: AbortSignal) {
  const response = await api.get(API_ROUTES.ADMIN.DASHBOARD, { signal });
  return response.data;
}

export async function getAdminOrganizations(page = 1, limit = 20, search?: string, status?: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  const response = await api.get(`${API_ROUTES.ADMIN.ORGANIZATIONS}?${params}`, { signal });
  return response.data;
}

export async function createAdminOrganization(data: {
  name: string;
  ownerEmail: string;
  ownerName: string;
  ownerPassword: string;
  planSlug?: string;
}) {
  const response = await api.post(API_ROUTES.ADMIN.ORGANIZATIONS, data);
  return response.data;
}

export async function suspendOrganization(id: string) {
  const response = await api.patch(`${API_ROUTES.ADMIN.ORGANIZATIONS}/${id}/suspend`);
  return response.data;
}

export async function activateOrganization(id: string) {
  const response = await api.patch(`${API_ROUTES.ADMIN.ORGANIZATIONS}/${id}/activate`);
  return response.data;
}

export async function deleteAdminOrganization(id: string) {
  const response = await api.delete(`${API_ROUTES.ADMIN.ORGANIZATIONS}/${id}`);
  return response.data;
}

export async function getAdminUsers(page = 1, limit = 20, search?: string, organizationId?: string, role?: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);
  if (organizationId) params.set('organizationId', organizationId);
  if (role) params.set('role', role);
  const response = await api.get(`${API_ROUTES.ADMIN.USERS}?${params}`, { signal });
  return response.data;
}

export async function getAdminAuditLogs(page = 1, limit = 20, search?: string, action?: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);
  if (action) params.set('action', action);
  const response = await api.get(`${API_ROUTES.ADMIN.AUDIT}?${params}`, { signal });
  return response.data;
}

export async function getAdminAuditActions(signal?: AbortSignal) {
  const response = await api.get(API_ROUTES.ADMIN.AUDIT_ACTIONS, { signal });
  return response.data;
}

export async function getAdminSettings(signal?: AbortSignal) {
  const response = await api.get(API_ROUTES.ADMIN.SETTINGS, { signal });
  return response.data;
}

export async function updateAdminSetting(key: string, value: unknown) {
  const response = await api.patch(API_ROUTES.ADMIN.SETTINGS, { key, value });
  return response.data;
}

export async function getAdminPlans(signal?: AbortSignal) {
  const response = await api.get(API_ROUTES.ADMIN.PLANS, { signal });
  return response.data;
}

export interface AdminOrganizationDetail {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  logo: string | null;
  isActive: boolean;
  suspendedAt: string | null;
  deletedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    users: number;
    members: number;
    customers: number;
    products: number;
    suppliers: number;
    invoices: number;
  };
  subscription: {
    id: string;
    status: string;
    plan: { name: string; slug: string } | null;
  } | null;
  settings: { settings: Record<string, unknown> | null } | null;
  owner: { id: string; name: string; email: string; avatar: string | null } | null;
}

export async function getAdminOrganization(id: string, signal?: AbortSignal) {
  const response = await api.get(`${API_ROUTES.ADMIN.ORGANIZATIONS}/${id}`, { signal });
  return response.data as AdminOrganizationDetail;
}

export interface OrganizationStatistics {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  isActive: boolean;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED' | 'DELETED';
  createdAt: string;
  lastActivity: string | null;
  owner: { id: string; name: string; email: string; avatar: string | null } | null;
  subscription: {
    plan: string | null;
    status: string;
    currentPeriodEnd: string;
  } | null;
  users: {
    total: number;
    active: number;
    inactive: number;
    totalLogins: number;
    monthlyLogins: number;
  };
  revenue: { total: number };
  usage: {
    customers: number;
    products: number;
    suppliers: number;
    invoices: number;
    auditEvents: number;
  };
  recentActivities: {
    id: string;
    action: string;
    entity: string | null;
    createdAt: string;
    user: { id: string; name: string; email: string } | null;
  }[];
}

export async function getAdminOrganizationStatistics(id: string, signal?: AbortSignal) {
  const response = await api.get(`${API_ROUTES.ADMIN.ORGANIZATIONS}/${id}/statistics`, { signal });
  return response.data as OrganizationStatistics;
}

export async function restoreAdminOrganization(id: string, reason?: string) {
  const response = await api.patch(`${API_ROUTES.ADMIN.ORGANIZATIONS}/${id}/restore`, { reason });
  return response.data;
}

export async function getAdminSettingHistory(key: string, signal?: AbortSignal) {
  const response = await api.get(`${API_ROUTES.ADMIN.SETTINGS}/${encodeURIComponent(key)}/history`, { signal });
  return response.data;
}
