import type { Meta } from '@/lib/types';

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

export type SupplierMeta = Meta;

export interface SuppliersResponse {
  data: Supplier[];
  meta: SupplierMeta;
}
