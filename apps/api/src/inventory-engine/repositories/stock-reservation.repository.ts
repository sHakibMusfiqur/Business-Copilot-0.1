import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { StockReservation, StockReservationRepository } from '../interfaces';

export class PrismaStockReservationRepository implements StockReservationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(organizationId: string, id: string): Promise<StockReservation | null> {
    return this.prisma.stockReservation.findFirst({
      where: { id, organizationId },
    });
  }

  async findByOrganization(organizationId: string): Promise<StockReservation[]> {
    return this.prisma.stockReservation.findMany({
      where: { organizationId },
    });
  }

  async create(
    data: Omit<StockReservation, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<StockReservation> {
    return this.prisma.stockReservation.create({
      data: data as Prisma.StockReservationUncheckedCreateInput,
    });
  }

  async update(
    organizationId: string,
    id: string,
    data: Partial<Omit<StockReservation, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<StockReservation> {
    return this.prisma.stockReservation.update({
      where: { id, organizationId },
      data: data as Prisma.StockReservationUncheckedUpdateInput,
    });
  }

  async verifyReferences(
    organizationId: string,
    references: { stockId?: string },
  ): Promise<boolean> {
    if (references.stockId !== undefined) {
      const stock = await this.prisma.stock.findFirst({
        where: { id: references.stockId, organizationId },
        select: { id: true },
      });
      if (!stock) return false;
    }
    return true;
  }
}
