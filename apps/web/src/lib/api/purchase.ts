import { api } from './client';
import { API_ROUTES } from './routes';

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

export async function getPurchases(params?: PurchaseListParams, signal?: AbortSignal) {
  const response = await api.get(API_ROUTES.PURCHASE.ROOT, { params, signal });
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
  const response = await api.post(API_ROUTES.PURCHASE.ROOT, data);
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
  const response = await api.patch(`${API_ROUTES.PURCHASE.ROOT}/${id}`, data);
  return response.data;
}

export async function approvePurchase(id: string) {
  const response = await api.post(`${API_ROUTES.PURCHASE.ROOT}/${id}/approve`);
  return response.data;
}

export async function receivePurchase(id: string, notes?: string) {
  const response = await api.post(`${API_ROUTES.PURCHASE.ROOT}/${id}/receive`, { notes });
  return response.data;
}

export async function deletePurchase(id: string) {
  const response = await api.delete(`${API_ROUTES.PURCHASE.ROOT}/${id}`);
  return response.data;
}
