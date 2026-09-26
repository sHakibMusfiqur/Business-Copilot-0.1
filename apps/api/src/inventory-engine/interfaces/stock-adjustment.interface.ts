import type { AdjustmentType, Prisma } from '@prisma/client';

export interface StockAdjustment {
  id: string;
  organizationId: string;
  stockId: string;
  adjustmentType: AdjustmentType;
  quantityBefore: number;
  quantityAfter: number;
  adjustmentQty: number;
  reason: string | null;
  notes: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
}
