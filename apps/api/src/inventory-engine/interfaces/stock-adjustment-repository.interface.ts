import type { StockAdjustment } from './stock-adjustment.interface';

// Append-only ledger: create and read operations only, never update or delete.
export interface StockAdjustmentRepository {
  findById(id: string): Promise<StockAdjustment | null>;
  findByOrganization(organizationId: string): Promise<StockAdjustment[]>;
  create(
    data: Omit<StockAdjustment, 'id' | 'createdAt'>,
  ): Promise<StockAdjustment>;
}
