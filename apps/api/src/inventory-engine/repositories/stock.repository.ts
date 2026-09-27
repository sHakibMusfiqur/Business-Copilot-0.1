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

  async verifyReferences(
    organizationId: string,
    references: {
      warehouseId?: string;
      productId?: string;
      batchId?: string;
      serialNumberId?: string;
    },
  ): Promise<boolean> {
    if (references.warehouseId !== undefined) {
      const warehouse = await this.prisma.warehouse.findFirst({
        where: { id: references.warehouseId, organizationId },
        select: { id: true },
      });
      if (!warehouse) return false;
    }
    if (references.productId !== undefined) {
      const product = await this.prisma.product.findFirst({
        where: { id: references.productId, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!product) return false;
    }
    if (references.batchId !== undefined) {
      const batch = await this.prisma.batch.findFirst({
        where: { id: references.batchId, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!batch) return false;
    }
    if (references.serialNumberId !== undefined) {
      const serialNumber = await this.prisma.serialNumber.findFirst({
        where: { id: references.serialNumberId, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!serialNumber) return false;
    }
    return true;
  }
}
