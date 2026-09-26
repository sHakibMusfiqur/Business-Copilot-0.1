import type { WarehouseTransfer } from './warehouse-transfer.interface';

export interface WarehouseTransferRepository {
  findById(organizationId: string, id: string): Promise<WarehouseTransfer | null>;
  findByOrganization(organizationId: string): Promise<WarehouseTransfer[]>;
  create(
    data: Omit<WarehouseTransfer, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<WarehouseTransfer>;
  update(
    organizationId: string,
    id: string,
    data: Partial<Omit<WarehouseTransfer, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<WarehouseTransfer>;
  delete(organizationId: string, id: string): Promise<void>;
}
