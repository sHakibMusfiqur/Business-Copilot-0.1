import { api } from './client';
import { API_ROUTES } from './routes';

export async function getDashboardOverview(signal?: AbortSignal) {
  const response = await api.get(API_ROUTES.DASHBOARD.OVERVIEW, { signal });
  return response.data;
}