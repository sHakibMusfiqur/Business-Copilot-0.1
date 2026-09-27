import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { StockMovement, StockMovementRepository } from '../interfaces';

// Append-only ledger: create and read only; no update/delete methods exist.
export class PrismaStockMovementRepository implements StockMovementRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(organizationId: string, id: string): Promise<StockMovement | null> {
    return this.prisma.stockMovement.findFirst({
      where: { id, organizationId },
    });
  }

  async findByOrganization(organizationId: string): Promise<StockMovement[]> {
    return this.prisma.stockMovement.findMany({
      where: { organizationId },
    });
  }

  async create(data: Omit<StockMovement, 'id' | 'createdAt'>): Promise<StockMovement> {
    return this.prisma.stockMovement.create({
      data: data as Prisma.StockMovementUncheckedCreateInput,
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
