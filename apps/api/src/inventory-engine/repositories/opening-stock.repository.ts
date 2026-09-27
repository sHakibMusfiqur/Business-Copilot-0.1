import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { OpeningStock, OpeningStockRepository } from '../interfaces';


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
