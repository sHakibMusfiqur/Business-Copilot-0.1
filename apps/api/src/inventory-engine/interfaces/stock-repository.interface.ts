import type { Stock } from './stock.interface';

export interface StockRepository {
  findById(organizationId: string, id: string): Promise<Stock | null>;
  findByOrganization(organizationId: string): Promise<Stock[]>;
  create(data: Omit<Stock, 'id' | 'createdAt' | 'updatedAt'>): Promise<Stock>;
  update(
    organizationId: string,
    id: string,
    data: Partial<Omit<Stock, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Stock>;
  verifyReferences(
    organizationId: string,
    references: {
      warehouseId?: string;
      productId?: string;
      batchId?: string;
      serialNumberId?: string;
    },
  ): Promise<boolean>;
}
