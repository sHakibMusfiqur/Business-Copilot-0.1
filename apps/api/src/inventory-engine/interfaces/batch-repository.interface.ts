import type { Batch } from './batch.interface';

export interface BatchRepository {
  findById(id: string): Promise<Batch | null>;
  findByOrganization(organizationId: string): Promise<Batch[]>;
  create(data: Omit<Batch, 'id' | 'createdAt' | 'updatedAt'>): Promise<Batch>;
  update(
    id: string,
    data: Partial<Omit<Batch, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Batch>;
  delete(id: string): Promise<void>;
}
