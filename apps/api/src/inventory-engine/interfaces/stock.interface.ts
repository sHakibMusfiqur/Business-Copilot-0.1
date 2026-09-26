import type { Prisma, StockStatus } from '@prisma/client';

export interface Stock {
  id: string;
  organizationId: string;
  warehouseId: string;
  productId: string;
  batchId: string | null;
  serialNumberId: string | null;
  quantity: number;
  reservedQuantity: number;
  damagedQuantity: number;
  returnedQuantity: number;
  inTransitQuantity: number;
  safetyStock: number;
  reorderLevel: number;
  unitCost: Prisma.Decimal;
  totalValue: Prisma.Decimal;
  status: StockStatus;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}
