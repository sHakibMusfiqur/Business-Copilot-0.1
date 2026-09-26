import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { WarehouseTransfer, WarehouseTransferRepository } from '../interfaces';

export class PrismaWarehouseTransferRepository
  implements WarehouseTransferRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findById(
    organizationId: string,
    id: string,
  ): Promise<WarehouseTransfer | null> {
    return this.prisma.warehouseTransfer.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
  }

  async findByOrganization(organizationId: string): Promise<WarehouseTransfer[]> {
    return this.prisma.warehouseTransfer.findMany({
      where: { organizationId, deletedAt: null },
    });
  }

  async create(
    data: Omit<WarehouseTransfer, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<WarehouseTransfer> {
    return this.prisma.warehouseTransfer.create({
      data: data as Prisma.WarehouseTransferUncheckedCreateInput,
    });
  }

  async update(
    organizationId: string,
    id: string,
    data: Partial<Omit<WarehouseTransfer, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<WarehouseTransfer> {
    return this.prisma.warehouseTransfer.update({
      where: { id, organizationId, deletedAt: null },
      data: data as Prisma.WarehouseTransferUncheckedUpdateInput,
    });
  }

  async delete(organizationId: string, id: string): Promise<void> {
    await this.prisma.warehouseTransfer.update({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }
}
