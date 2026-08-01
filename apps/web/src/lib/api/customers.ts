import { api } from './client';
import { API_ROUTES } from './routes';

export interface CustomerListParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getCustomers(params?: CustomerListParams, signal?: AbortSignal) {
  const response = await api.get(API_ROUTES.CUSTOMERS.ROOT, { params, signal });
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
  const response = await api.post(API_ROUTES.CUSTOMERS.ROOT, data);
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
  const response = await api.patch(`${API_ROUTES.CUSTOMERS.ROOT}/${id}`, data);
  return response.data;
}

export async function deleteCustomer(id: string) {
  const response = await api.delete(`${API_ROUTES.CUSTOMERS.ROOT}/${id}`);
  return response.data;
}

export async function updateCustomerStatus(id: string, isActive: boolean) {
  const response = await api.patch(`${API_ROUTES.CUSTOMERS.ROOT}/${id}/status`, { isActive });
  return response.data;
}
