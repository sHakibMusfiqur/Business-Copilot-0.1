import { api } from './client';
import { API_ROUTES } from './routes';

export interface SupplierListParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getSuppliers(params?: SupplierListParams, signal?: AbortSignal) {
  const response = await api.get(API_ROUTES.SUPPLIERS.ROOT, { params, signal });
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
  const response = await api.post(API_ROUTES.SUPPLIERS.ROOT, data);
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
  const response = await api.patch(`${API_ROUTES.SUPPLIERS.ROOT}/${id}`, data);
  return response.data;
}

export async function deleteSupplier(id: string) {
  const response = await api.delete(`${API_ROUTES.SUPPLIERS.ROOT}/${id}`);
  return response.data;
}

export async function updateSupplierStatus(id: string, isActive: boolean) {
  const response = await api.patch(`${API_ROUTES.SUPPLIERS.ROOT}/${id}/status`, { isActive });
  return response.data;
}
