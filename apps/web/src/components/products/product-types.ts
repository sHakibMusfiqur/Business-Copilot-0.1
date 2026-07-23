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

export interface ProductMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ProductsResponse {
  data: Product[];
  meta: ProductMeta;
}

export interface CreateProductPayload {
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
}

export interface UpdateProductPayload {
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
}

export interface CategoryOption {
  id: string;
  name: string;
}

export interface SupplierOption {
  id: string;
  name: string;
}
