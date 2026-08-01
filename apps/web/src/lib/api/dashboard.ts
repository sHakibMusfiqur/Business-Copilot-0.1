import { NotImplementedError, api } from './client';
import { API_ROUTES } from './routes';

export async function getDashboardOverview(signal?: AbortSignal) {
  const response = await api.get(API_ROUTES.DASHBOARD.OVERVIEW, { signal });
  return response.data;
}

export async function getDashboardAnalytics(): Promise<unknown> {
  throw new NotImplementedError('getDashboardAnalytics');
}

export async function getDashboardCharts(): Promise<unknown> {
  throw new NotImplementedError('getDashboardCharts');
}

export async function getDashboardNotifications(): Promise<unknown> {
  throw new NotImplementedError('getDashboardNotifications');
}
