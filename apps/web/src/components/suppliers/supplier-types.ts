export interface Supplier {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  taxId: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  paymentTerms: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SuppliersResponse {
  data: Supplier[];
  meta: SupplierMeta;
}

export interface CreateSupplierPayload {
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
}

export interface UpdateSupplierPayload {
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
}
