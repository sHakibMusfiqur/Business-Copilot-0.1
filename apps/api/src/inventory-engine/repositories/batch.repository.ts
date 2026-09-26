import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { Batch, BatchRepository } from '../interfaces';

export class PrismaBatchRepository implements BatchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(organizationId: string, id: string): Promise<Batch | null> {
    return this.prisma.batch.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
  }

  async findByOrganization(organizationId: string): Promise<Batch[]> {
    return this.prisma.batch.findMany({
      where: { organizationId, deletedAt: null },
    });
  }

  async create(
    data: Omit<Batch, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Batch> {
    return this.prisma.batch.create({
      data: data as Prisma.BatchUncheckedCreateInput,
    });
  }

  async update(
    organizationId: string,
    id: string,
    data: Partial<Omit<Batch, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Batch> {
    return this.prisma.batch.update({
      where: { id, organizationId, deletedAt: null },
      data: data as Prisma.BatchUncheckedUpdateInput,
    });
  }

  async delete(organizationId: string, id: string): Promise<void> {
    await this.prisma.batch.update({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }
}
