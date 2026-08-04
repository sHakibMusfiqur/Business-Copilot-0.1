import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { tenantExtension, withTenantScope } from '@bc/db';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async withOrg<T>(
    organizationId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    userId?: string,
  ): Promise<T> {
    return withTenantScope(this.prisma, { organizationId, userId }, fn);
  }

  scopedClient(organizationId: string, userId?: string) {
    return this.prisma.$extends(tenantExtension({ organizationId, userId }));
  }
}