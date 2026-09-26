import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { SerialNumber, SerialNumberRepository } from '../interfaces';

export class PrismaSerialNumberRepository implements SerialNumberRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(organizationId: string, id: string): Promise<SerialNumber | null> {
    return this.prisma.serialNumber.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
  }

  async findByOrganization(organizationId: string): Promise<SerialNumber[]> {
    return this.prisma.serialNumber.findMany({
      where: { organizationId, deletedAt: null },
    });
  }

  async create(
    data: Omit<SerialNumber, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<SerialNumber> {
    return this.prisma.serialNumber.create({
      data: data as Prisma.SerialNumberUncheckedCreateInput,
    });
  }

  async update(
    organizationId: string,
    id: string,
    data: Partial<Omit<SerialNumber, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<SerialNumber> {
    return this.prisma.serialNumber.update({
      where: { id, organizationId, deletedAt: null },
      data: data as Prisma.SerialNumberUncheckedUpdateInput,
    });
  }

  async delete(organizationId: string, id: string): Promise<void> {
    await this.prisma.serialNumber.update({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }
}
