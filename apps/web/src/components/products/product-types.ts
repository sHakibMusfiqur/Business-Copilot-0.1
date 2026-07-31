import type { Meta } from '@/lib/types';

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  brand: string | null;
  description: string | null;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  supplierId: string | null;
  supplier: { id: string; name: string } | null;
  unitPrice: number;
  costPrice: number;
  unit: string;
  taxRate: number;
  minimumStock: number;
  maximumStock: number;
  currentStock: number;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ProductMeta = Meta;

export interface ProductsResponse {
  data: Product[];
  meta: ProductMeta;
}

export interface CategoryOption {
  id: string;
  name: string;
}
