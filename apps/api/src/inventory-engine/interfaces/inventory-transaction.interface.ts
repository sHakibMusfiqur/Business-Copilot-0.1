import type {
  InventoryTransactionType,
  Prisma,
  TransactionType,
} from '@prisma/client';


export interface InventoryTransaction {
  id: string;
  organizationId: string;
  productId: string;
  type: TransactionType;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reference: string | null;
  notes: string | null;
  createdById: string;
  createdAt: Date;
  transactionType: InventoryTransactionType | null;
  referenceType: string | null;
  referenceId: string | null;
  totalQuantity: number | null;
  totalValue: Prisma.Decimal | null;
  status: string | null;
  metadata: Prisma.JsonValue | null;
}
