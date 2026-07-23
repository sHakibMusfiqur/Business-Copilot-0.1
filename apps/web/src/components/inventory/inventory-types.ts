export interface InventoryProduct {
  id: string;
  name: string;
  sku: string;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  supplierId: string | null;
  supplier: { id: string; name: string } | null;
  unitPrice: number;
  costPrice: number;
  minimumStock: number;
  maximumStock: number;
  currentStock: number;
  isActive: boolean;
  updatedAt: string;
}

export interface InventoryMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface InventoryResponse {
  data: InventoryProduct[];
  meta: InventoryMeta;
}

export interface InventoryTransaction {
  id: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  createdBy: { id: string; name: string };
}

export interface InventorySummary {
  totalProducts: number;
  totalStockUnits: number;
  inventoryValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  averageProductValue: number;
}
