import type { Batch } from './batch.interface';

export interface BatchRepository {
  findById(organizationId: string, id: string): Promise<Batch | null>;
  findByOrganization(organizationId: string): Promise<Batch[]>;
  create(data: Omit<Batch, 'id' | 'createdAt' | 'updatedAt'>): Promise<Batch>;
  update(
    organizationId: string,
    id: string,
    data: Partial<Omit<Batch, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Batch>;
  delete(organizationId: string, id: string): Promise<void>;
}
