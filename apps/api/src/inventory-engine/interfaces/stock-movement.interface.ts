import type { Prisma, StockMovementType } from '@prisma/client';

export interface StockMovement {
  id: string;
  organizationId: string;
  stockId: string;
  movementType: StockMovementType;
  quantity: number;
  unitCost: Prisma.Decimal;
  totalCost: Prisma.Decimal;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
}
