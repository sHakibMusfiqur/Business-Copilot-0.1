import type { Prisma, ReservationStatus } from '@prisma/client';

export interface StockReservation {
  id: string;
  organizationId: string;
  stockId: string;
  quantity: number;
  reservedQuantity: number;
  status: ReservationStatus;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  expiresAt: Date | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}
