import type { Prisma, TransferStatus } from '@prisma/client';

export interface WarehouseTransfer {
  id: string;
  organizationId: string;
  sourceWarehouseId: string;
  destWarehouseId: string;
  transferNumber: string;
  status: TransferStatus;
  notes: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
