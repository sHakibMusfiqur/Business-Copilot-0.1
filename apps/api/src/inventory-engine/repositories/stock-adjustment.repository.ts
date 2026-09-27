import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { StockAdjustment, StockAdjustmentRepository } from '../interfaces';

// Append-only ledger: create and read only; no update/delete methods exist.
export class PrismaStockAdjustmentRepository implements StockAdjustmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(organizationId: string, id: string): Promise<StockAdjustment | null> {
    return this.prisma.stockAdjustment.findFirst({
      where: { id, organizationId },
    });
  }

  async findByOrganization(organizationId: string): Promise<StockAdjustment[]> {
    return this.prisma.stockAdjustment.findMany({
      where: { organizationId },
    });
  }

  async create(
    data: Omit<StockAdjustment, 'id' | 'createdAt'>,
  ): Promise<StockAdjustment> {
    return this.prisma.stockAdjustment.create({
      data: data as Prisma.StockAdjustmentUncheckedCreateInput,
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
