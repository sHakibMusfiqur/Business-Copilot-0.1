import type { OpeningStock } from './opening-stock.interface';

export interface OpeningStockRepository {
  findById(organizationId: string, id: string): Promise<OpeningStock | null>;
  findByOrganization(organizationId: string): Promise<OpeningStock[]>;
  create(
    data: Omit<OpeningStock, 'id' | 'createdAt'>,
  ): Promise<OpeningStock>;
  update(
    organizationId: string,
    id: string,
    data: Partial<Omit<OpeningStock, 'id' | 'createdAt'>>,
  ): Promise<OpeningStock>;
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
