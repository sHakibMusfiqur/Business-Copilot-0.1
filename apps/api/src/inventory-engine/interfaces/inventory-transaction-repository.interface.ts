import type { InventoryTransaction } from './inventory-transaction.interface';

// Ledger semantics: create and read operations only, never update or delete.
export interface InventoryTransactionRepository {
  findById(organizationId: string, id: string): Promise<InventoryTransaction | null>;
  findByOrganization(organizationId: string): Promise<InventoryTransaction[]>;
  create(
    data: Omit<InventoryTransaction, 'id' | 'createdAt'>,
  ): Promise<InventoryTransaction>;
}
