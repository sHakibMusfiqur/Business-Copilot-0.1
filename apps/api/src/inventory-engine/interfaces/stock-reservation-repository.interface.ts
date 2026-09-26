import type { StockReservation } from './stock-reservation.interface';

export interface StockReservationRepository {
  findById(id: string): Promise<StockReservation | null>;
  findByOrganization(organizationId: string): Promise<StockReservation[]>;
  create(
    data: Omit<StockReservation, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<StockReservation>;
  update(
    id: string,
    data: Partial<Omit<StockReservation, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<StockReservation>;
}
