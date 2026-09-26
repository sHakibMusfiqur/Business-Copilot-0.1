import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { OpeningStock, OpeningStockRepository } from '../interfaces';

// Standalone ledger: deliberately no relation to Stock; batchId/serialNumberId
// remain plain nullable scalars.
export class PrismaOpeningStockRepository implements OpeningStockRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(organizationId: string, id: string): Promise<OpeningStock | null> {
    return this.prisma.openingStock.findFirst({
      where: { id, organizationId },
    });
  }

  async findByOrganization(organizationId: string): Promise<OpeningStock[]> {
    return this.prisma.openingStock.findMany({
      where: { organizationId },
    });
  }

  async create(data: Omit<OpeningStock, 'id' | 'createdAt'>): Promise<OpeningStock> {
    return this.prisma.openingStock.create({
      data: data as Prisma.OpeningStockUncheckedCreateInput,
    });
  }

  async update(
    organizationId: string,
    id: string,
    data: Partial<Omit<OpeningStock, 'id' | 'createdAt'>>,
  ): Promise<OpeningStock> {
    return this.prisma.openingStock.update({
      where: { id, organizationId },
      data: data as Prisma.OpeningStockUncheckedUpdateInput,
    });
  }
}
