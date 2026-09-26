import type { Stock } from './stock.interface';

export interface StockRepository {
  findById(id: string): Promise<Stock | null>;
  findByOrganization(organizationId: string): Promise<Stock[]>;
  create(data: Omit<Stock, 'id' | 'createdAt' | 'updatedAt'>): Promise<Stock>;
  update(
    id: string,
    data: Partial<Omit<Stock, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Stock>;
}
