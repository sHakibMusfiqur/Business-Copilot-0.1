import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type {
  InventoryTransaction,
  InventoryTransactionRepository,
} from '../interfaces';


export class PrismaInventoryTransactionRepository
  implements InventoryTransactionRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findById(
    organizationId: string,
    id: string,
  ): Promise<InventoryTransaction | null> {
    return this.prisma.inventoryTransaction.findFirst({
      where: { id, organizationId },
    });
  }

  async findByOrganization(
    organizationId: string,
  ): Promise<InventoryTransaction[]> {
    return this.prisma.inventoryTransaction.findMany({
      where: { organizationId },
    });
  }

  async create(
    data: Omit<InventoryTransaction, 'id' | 'createdAt'>,
  ): Promise<InventoryTransaction> {
    return this.prisma.inventoryTransaction.create({
      data: data as Prisma.InventoryTransactionUncheckedCreateInput,
    });
  }
}
