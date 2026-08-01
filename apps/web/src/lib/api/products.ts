import { api } from './client';
import { API_ROUTES } from './routes';

export interface ProductListParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  categoryId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getProducts(params?: ProductListParams, signal?: AbortSignal) {
  const response = await api.get(API_ROUTES.PRODUCTS.ROOT, { params, signal });
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
  const response = await api.post(API_ROUTES.PRODUCTS.ROOT, data);
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
  const response = await api.patch(`${API_ROUTES.PRODUCTS.ROOT}/${id}`, data);
  return response.data;
}

export async function deleteProduct(id: string) {
  const response = await api.delete(`${API_ROUTES.PRODUCTS.ROOT}/${id}`);
  return response.data;
}

export async function updateProductStatus(id: string, isActive: boolean) {
  const response = await api.patch(`${API_ROUTES.PRODUCTS.ROOT}/${id}/status`, { isActive });
  return response.data;
}

export async function getCategories(signal?: AbortSignal) {
  const response = await api.get(API_ROUTES.PRODUCTS.CATEGORIES, { signal });
  return response.data;
}
