import { api } from './client';
import { API_ROUTES } from './routes';

export async function getAuditLogs(params?: {
  page?: number;
  limit?: number;
  search?: string;
  action?: string;
  entity?: string;
  userId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}, signal?: AbortSignal) {
  const response = await api.get(API_ROUTES.AUDIT.ROOT, { params, signal });
  return response.data;
}
