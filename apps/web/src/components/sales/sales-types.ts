import type { Meta } from '@/lib/types';

export type SalesStatus = 'DRAFT' | 'PENDING' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED';

export interface SaleCustomer {
  id: string;
  name: string;
}

export interface SaleCreatedBy {
  id: string;
  name: string;
}

export interface SaleItem {
  id: string;
  productId: string | null;
  product: { id: string; name: string; sku: string } | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  lineTotal: number;
}

export interface Sale {
  id: string;
  orderNumber: string;
  status: SalesStatus;
  subtotal: number;
  discount: number;
  tax: number;
  shippingCost: number;
  total: number;
  notes: string | null;
  orderDate: string;
  createdAt: string;
  updatedAt?: string;
  customer: SaleCustomer | null;
  createdBy: SaleCreatedBy | null;
  items: SaleItem[];
  itemCount?: number;
}

export type SaleMeta = Meta;

export interface SaleListResponse {
  data: Sale[];
  meta: SaleMeta;
}
