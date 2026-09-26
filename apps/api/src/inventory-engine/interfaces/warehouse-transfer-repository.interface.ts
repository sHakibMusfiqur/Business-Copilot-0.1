import type { WarehouseTransfer } from './warehouse-transfer.interface';

export interface WarehouseTransferRepository {
  findById(id: string): Promise<WarehouseTransfer | null>;
  findByOrganization(organizationId: string): Promise<WarehouseTransfer[]>;
  create(
    data: Omit<WarehouseTransfer, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<WarehouseTransfer>;
  update(
    id: string,
    data: Partial<Omit<WarehouseTransfer, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<WarehouseTransfer>;
  delete(id: string): Promise<void>;
}
