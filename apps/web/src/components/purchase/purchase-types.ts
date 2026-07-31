import type { Meta } from '@/lib/types';

export type PurchaseStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseSupplier {
  id: string;
  name: string;
}

export interface PurchaseCreatedBy {
  id: string;
  name: string;
}

export interface PurchaseItem {
  id: string;
  productId: string | null;
  product: { id: string; name: string; sku: string } | null;
  quantity: number;
  unitCost: number;
  discount: number;
  tax: number;
  lineTotal: number;
}

export interface Purchase {
  id: string;
  orderNumber: string;
  status: PurchaseStatus;
  subtotal: number;
  discount: number;
  tax: number;
  shippingCost: number;
  total: number;
  notes: string | null;
  orderDate: string;
  createdAt: string;
  updatedAt?: string;
  supplier: PurchaseSupplier | null;
  createdBy: PurchaseCreatedBy | null;
  items: PurchaseItem[];
  itemCount?: number;
}

export type PurchaseMeta = Meta;

export interface PurchaseListResponse {
  data: Purchase[];
  meta: PurchaseMeta;
}
