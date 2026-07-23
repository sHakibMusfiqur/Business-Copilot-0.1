import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { DEFAULT_QUICK_ACTIONS } from './quick-actions.config';
import type { QuickAction } from './quick-actions.config';

export interface DashboardOrganization {
  id: string;
  name: string;
  logo: string | null;
  createdAt: Date;
}

export interface DashboardStatistics {
  totalUsers: number;
  totalCustomers: number;
  totalProducts: number;
  totalSuppliers: number;
  totalInvoices: number;
  totalPurchaseOrders: number;
  lowStockProducts: number;
  monthlyRevenue: number;
  monthlyExpense: number;
}

export interface RecentActivityItem {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  user: { id: string; name: string; email: string } | null;
  createdAt: Date;
}

export interface DashboardOverview {
  organization: DashboardOrganization;
  statistics: DashboardStatistics;
  quickActions: QuickAction[];
  recentActivities: RecentActivityItem[];
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOverview(orgId: string, userId: string): Promise<DashboardOverview> {
    await this.validateOrgMembership(orgId, userId);

    const [
      organization,
      totalUsers,
      totalCustomers,
      totalProducts,
      totalSuppliers,
      totalInvoices,
      totalPurchaseOrders,
      lowStockProducts,
      monthlyRevenue,
      monthlyExpense,
      recentActivities,
    ] = await Promise.all([
      this.getOrganization(orgId),
      this.safeCount(this.prisma.user.count({ where: { organizationId: orgId } })),
      this.safeCount(this.prisma.customer.count({ where: { organizationId: orgId } })),
      this.safeCount(this.prisma.product.count({ where: { organizationId: orgId } })),
      this.safeCount(this.prisma.supplier.count({ where: { organizationId: orgId } })),
      this.safeCount(this.prisma.invoice.count({ where: { organizationId: orgId } })),
      this.safeCount(this.prisma.purchaseOrder.count({ where: { organizationId: orgId } })),
      this.getLowStockCount(orgId),
      this.getMonthlyRevenue(orgId),
      this.getMonthlyExpense(orgId),
      this.getRecentActivities(orgId),
    ]);

    return {
      organization,
      statistics: {
        totalUsers,
        totalCustomers,
        totalProducts,
        totalSuppliers,
        totalInvoices,
        totalPurchaseOrders,
        lowStockProducts,
        monthlyRevenue,
        monthlyExpense,
      },
      quickActions: DEFAULT_QUICK_ACTIONS,
      recentActivities,
    };
  }

  private async validateOrgMembership(orgId: string, userId: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      select: { id: true },
    });

    if (!membership) {
      throw new ForbiddenException('User is not a member of this organization');
    }
  }

  private async getOrganization(orgId: string): Promise<DashboardOrganization> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, logo: true, createdAt: true },
    });

    return {
      id: org?.id ?? '',
      name: org?.name ?? 'Unknown',
      logo: org?.logo ?? null,
      createdAt: org?.createdAt ?? new Date(),
    };
  }

  private async getLowStockCount(orgId: string): Promise<number> {
    try {
      const rows = await this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT i."productId") as count
        FROM "Inventory" i
        INNER JOIN "Product" p ON p.id = i."productId"
        WHERE p."organizationId" = ${orgId}
          AND i.quantity <= i."minStock"
      `;
      return Number(rows[0]?.count ?? 0);
    } catch (error) {
      this.logger.error(`Low stock query failed: ${(error as Error).message}`);
      return 0;
    }
  }

  private async getMonthlyRevenue(orgId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    try {
      const result = await this.prisma.invoice.aggregate({
        where: {
          organizationId: orgId,
          type: 'SALES',
          paymentStatus: 'PAID',
          issueDate: { gte: startOfMonth },
        },
        _sum: { total: true },
      });

      return Number(result._sum.total ?? 0);
    } catch (error) {
      this.logger.error(`Monthly revenue query failed: ${(error as Error).message}`);
      return 0;
    }
  }

  private async getMonthlyExpense(orgId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    try {
      const result = await this.prisma.purchaseOrder.aggregate({
        where: {
          organizationId: orgId,
          orderDate: { gte: startOfMonth },
          status: { not: 'CANCELLED' },
        },
        _sum: { total: true },
      });

      return Number(result._sum.total ?? 0);
    } catch (error) {
      this.logger.error(`Monthly expense query failed: ${(error as Error).message}`);
      return 0;
    }
  }

  private async getRecentActivities(orgId: string): Promise<RecentActivityItem[]> {
    try {
      return await this.prisma.auditLog.findMany({
        where: { user: { organizationId: orgId } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
    } catch (error) {
      this.logger.error(`Recent activities query failed: ${(error as Error).message}`);
      return [];
    }
  }

  private async safeCount(query: Promise<number>): Promise<number> {
    try {
      return await query;
    } catch (error) {
      this.logger.error(`Dashboard count query failed: ${(error as Error).message}`);
      return 0;
    }
  }
}
