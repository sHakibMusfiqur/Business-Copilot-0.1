import type { Meta } from '@/lib/types';

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

export type CustomerMeta = Meta;

export interface CustomersResponse {
  data: Customer[];
  meta: CustomerMeta;
}
