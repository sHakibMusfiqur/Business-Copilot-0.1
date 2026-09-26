import type { BatchStatus, Prisma } from '@prisma/client';

export interface Batch {
  id: string;
  organizationId: string;
  productId: string;
  batchNumber: string;
  manufacturingDate: Date | null;
  expiryDate: Date | null;
  status: BatchStatus;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
