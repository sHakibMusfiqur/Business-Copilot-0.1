import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async findAll(orgId: string) {
    return this.prisma.category.findMany({
      where: {
        isActive: true,
        OR: [{ organizationId: orgId }, { organizationId: null }],
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
}
