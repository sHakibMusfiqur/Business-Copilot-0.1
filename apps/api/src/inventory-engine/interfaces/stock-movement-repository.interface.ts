import type { StockMovement } from './stock-movement.interface';

// Append-only ledger: create and read operations only, never update or delete.
export interface StockMovementRepository {
  findById(id: string): Promise<StockMovement | null>;
  findByOrganization(organizationId: string): Promise<StockMovement[]>;
  create(data: Omit<StockMovement, 'id' | 'createdAt'>): Promise<StockMovement>;
}
