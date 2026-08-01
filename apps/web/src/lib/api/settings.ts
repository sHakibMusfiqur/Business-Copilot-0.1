import { api } from './client';
import { API_ROUTES } from './routes';

export type SettingsNamespace =
  | 'branding'
  | 'tax'
  | 'email'
  | 'billing'
  | 'preferences'
  | 'notifications';

export async function getSettings<T = Record<string, unknown>>(
  namespace: SettingsNamespace,
  signal?: AbortSignal,
): Promise<T | null> {
  const response = await api.get<T | null>(`${API_ROUTES.SETTINGS.ROOT}/${namespace}`, { signal });
  return response.data;
}

export async function updateSettings<T extends object>(
  namespace: SettingsNamespace,
  settings: T,
): Promise<T> {
  const response = await api.put<T>(`${API_ROUTES.SETTINGS.ROOT}/${namespace}`, settings);
  return response.data;
}

export async function uploadSettingsFiles(files: {
  logo?: File;
  favicon?: File;
}): Promise<{ logoUrl?: string; faviconUrl?: string }> {
  const formData = new FormData();
  if (files.logo) formData.append('logo', files.logo);
  if (files.favicon) formData.append('favicon', files.favicon);
  const response = await api.post<{ logoUrl?: string; faviconUrl?: string }>(
    API_ROUTES.SETTINGS.FILES,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return response.data;
}
