import type { Prisma } from '@prisma/client';

export interface OpeningStock {
  id: string;
  organizationId: string;
  warehouseId: string;
  productId: string;
  batchId: string | null;
  serialNumberId: string | null;
  quantity: number;
  unitCost: Prisma.Decimal;
  totalValue: Prisma.Decimal;
  referenceDate: Date;
  notes: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
}
