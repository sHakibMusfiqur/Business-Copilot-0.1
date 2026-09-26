import type { StockReservation } from './stock-reservation.interface';

export interface StockReservationRepository {
  findById(organizationId: string, id: string): Promise<StockReservation | null>;
  findByOrganization(organizationId: string): Promise<StockReservation[]>;
  create(
    data: Omit<StockReservation, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<StockReservation>;
  update(
    organizationId: string,
    id: string,
    data: Partial<Omit<StockReservation, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<StockReservation>;
}
