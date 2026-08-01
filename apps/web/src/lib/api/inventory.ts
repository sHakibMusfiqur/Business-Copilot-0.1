import { api } from './client';
import { API_ROUTES } from './routes';

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

export async function getInventory(params?: InventoryListParams, signal?: AbortSignal) {
  const response = await api.get(API_ROUTES.INVENTORY.ROOT, { params, signal });
  return response.data;
}

export async function adjustStock(data: {
  productId: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  notes?: string;
}) {
  const response = await api.post(API_ROUTES.INVENTORY.ADJUST, data);
  return response.data;
}

export async function getInventoryHistory(productId: string, signal?: AbortSignal) {
  const response = await api.get(`${API_ROUTES.INVENTORY.ROOT}/${productId}/history`, { signal });
  return response.data;
}

export async function getInventorySummary(signal?: AbortSignal) {
  const response = await api.get(API_ROUTES.INVENTORY.SUMMARY, { signal });
  return response.data;
}
