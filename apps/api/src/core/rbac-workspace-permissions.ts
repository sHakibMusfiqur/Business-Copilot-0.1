import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';



@Injectable()
export class RbacWorkspacePermissions {
  constructor(private readonly prisma: PrismaService) {}

  async resolveForUser(orgId: string, userId: string): Promise<string[]> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found in this organization');
    }

    const rows = await this.prisma.rolePermission.findMany({
      where: {
        role: {
          organizationId: orgId,
          userAssignments: { some: { userId } },
        },
      },
      select: { permission: { select: { name: true } } },
    });

    return Array.from(new Set(rows.map((row) => row.permission.name))).sort();
  }
}