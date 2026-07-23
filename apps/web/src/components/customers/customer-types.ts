export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  taxId: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CustomersResponse {
  data: Customer[];
  meta: CustomerMeta;
}

export interface CreateCustomerPayload {
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
}

export interface UpdateCustomerPayload {
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
}
