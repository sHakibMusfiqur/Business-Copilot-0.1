import type { SerialNumber } from './serial-number.interface';

export interface SerialNumberRepository {
  findById(id: string): Promise<SerialNumber | null>;
  findByOrganization(organizationId: string): Promise<SerialNumber[]>;
  create(
    data: Omit<SerialNumber, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<SerialNumber>;
  update(
    id: string,
    data: Partial<Omit<SerialNumber, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<SerialNumber>;
  delete(id: string): Promise<void>;
}
