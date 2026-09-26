import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { Stock, StockRepository } from '../interfaces';

export class PrismaStockRepository implements StockRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(organizationId: string, id: string): Promise<Stock | null> {
    return this.prisma.stock.findFirst({
      where: { id, organizationId },
    });
  }

  async findByOrganization(organizationId: string): Promise<Stock[]> {
    return this.prisma.stock.findMany({
      where: { organizationId },
    });
  }

  async create(
    data: Omit<Stock, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Stock> {
    return this.prisma.stock.create({
      data: data as Prisma.StockUncheckedCreateInput,
    });
  }

  async update(
    organizationId: string,
    id: string,
    data: Partial<Omit<Stock, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Stock> {
    return this.prisma.stock.update({
      where: { id, organizationId },
      data: data as Prisma.StockUncheckedUpdateInput,
    });
  }
}
