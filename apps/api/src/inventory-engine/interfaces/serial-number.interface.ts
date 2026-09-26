import type { Prisma, SerialStatus } from '@prisma/client';

export interface SerialNumber {
  id: string;
  organizationId: string;
  productId: string;
  batchId: string | null;
  serialNumber: string;
  status: SerialStatus;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
