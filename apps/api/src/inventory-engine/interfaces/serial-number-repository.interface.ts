import type { SerialNumber } from './serial-number.interface';

export interface SerialNumberRepository {
  findById(organizationId: string, id: string): Promise<SerialNumber | null>;
  findByOrganization(organizationId: string): Promise<SerialNumber[]>;
  create(
    data: Omit<SerialNumber, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<SerialNumber>;
  update(
    organizationId: string,
    id: string,
    data: Partial<Omit<SerialNumber, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<SerialNumber>;
  delete(organizationId: string, id: string): Promise<void>;
  verifyReferences(
    organizationId: string,
    references: { productId?: string; batchId?: string },
  ): Promise<boolean>;
}
