import type { OpeningStock } from './opening-stock.interface';

export interface OpeningStockRepository {
  findById(id: string): Promise<OpeningStock | null>;
  findByOrganization(organizationId: string): Promise<OpeningStock[]>;
  create(
    data: Omit<OpeningStock, 'id' | 'createdAt'>,
  ): Promise<OpeningStock>;
  update(
    id: string,
    data: Partial<Omit<OpeningStock, 'id' | 'createdAt'>>,
  ): Promise<OpeningStock>;
}
