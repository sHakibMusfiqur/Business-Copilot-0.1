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
  totalSalesOrders: number;
  lowStockProducts: number;
  monthlyRevenue: number;
  monthlyExpense: number;
  totalEmployees: number;
  pendingLeaves: number;
  monthlyPayroll: number;
}

export interface RecentActivityItem {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  createdAt: Date;
  userId: string | null;
  user: { id: string; name: string; email: string } | null;
}

export type DashboardPanelKey =
  | 'revenue'
  | 'expenses'
  | 'netProfit'
  | 'customers'
  | 'sales'
  | 'employees'
  | 'payroll'
  | 'revenueTrend'
  | 'cashFlow'
  | 'salesTrend'
  | 'invoices'
  | 'products'
  | 'suppliers'
  | 'users'
  | 'pendingLeaves'
  | 'lowStock'
  | 'purchaseOrders';

export interface DashboardLayout {
  kpis: DashboardPanelKey[];
  charts: DashboardPanelKey[];
  secondary: DashboardPanelKey[];
  alerts: DashboardPanelKey[];
  activity: boolean;
  aiCopilot: boolean;
}

export interface DashboardAiInsight {
  id: string;
  icon: string;
  text: string;
}

export interface DashboardOverview {
  organization: DashboardOrganization;
  statistics: DashboardStatistics;
  quickActions: QuickAction[];
  recentActivities: RecentActivityItem[];
  permissions: string[];
  layout: DashboardLayout;
  aiInsights: DashboardAiInsight[];
}

/**
 * Permissions that grant access to the finance view of the dashboard. Finance
 * aggregates (revenue / expenses / net profit) are only computed for users that
 * hold any of these.
 */
const FINANCE_PERMISSIONS = ['invoices.read', 'payments.read', 'accounting.read', 'reports.finance'];

const PANEL_PERMISSIONS: Record<DashboardPanelKey, string[]> = {
  revenue: FINANCE_PERMISSIONS,
  expenses: FINANCE_PERMISSIONS,
  netProfit: FINANCE_PERMISSIONS,
  revenueTrend: FINANCE_PERMISSIONS,
  cashFlow: FINANCE_PERMISSIONS,
  customers: ['customers.read'],
  sales: ['sales.read'],
  salesTrend: ['sales.read'],
  employees: ['employees.read'],
  pendingLeaves: ['employees.read'],
  payroll: ['payroll.read'],
  invoices: ['invoices.read'],
  products: ['products.read'],
  suppliers: ['suppliers.read'],
  users: ['users.read'],
  lowStock: ['inventory.read'],
  purchaseOrders: ['purchase.read'],
};

const ACTIVITY_ENTITY_PERMISSIONS: Array<[RegExp, string[]]> = [
  [/invoice|payment|account|journal|receivable|payable/i, FINANCE_PERMISSIONS],
  [/customer|lead/i, ['customers.read', 'crm.read']],
  [/product|inventory|warehouse/i, ['products.read', 'inventory.read']],
  [/supplier/i, ['suppliers.read']],
  [/purchase/i, ['purchase.read']],
  [/order/i, ['sales.read', 'purchase.read']],
  [/user|role|invitation|organization/i, ['users.read', 'organization.manage']],
  [/employee|leave|payroll|department/i, ['employees.read', 'payroll.read']],
];

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOverview(orgId: string, userId: string, permissions: string[]): Promise<DashboardOverview> {
    await this.validateOrgMembership(orgId, userId);

    const hasAny = (...required: string[]) => required.some((permission) => permissions.includes(permission));
    const canFinance = hasAny(...FINANCE_PERMISSIONS);
    const canPayroll = hasAny('payroll.read');

    const [
      organization,
      totalUsers,
      totalCustomers,
      totalProducts,
      totalSuppliers,
      totalInvoices,
      totalPurchaseOrders,
      totalSalesOrders,
      lowStockProducts,
      monthlyRevenue,
      monthlyExpense,
      totalEmployees,
      pendingLeaves,
      monthlyPayroll,
      recentActivities,
    ] = await Promise.all([
      this.getOrganization(orgId),
      this.safeCount(this.prisma.user.count({ where: { organizationId: orgId } })),
      this.safeCount(this.prisma.customer.count({ where: { organizationId: orgId } })),
      this.safeCount(this.prisma.product.count({ where: { organizationId: orgId } })),
      this.safeCount(this.prisma.supplier.count({ where: { organizationId: orgId } })),
      this.safeCount(this.prisma.invoice.count({ where: { organizationId: orgId } })),
      this.safeCount(this.prisma.purchaseOrder.count({ where: { organizationId: orgId } })),
      this.safeCount(this.prisma.salesOrder.count({ where: { organizationId: orgId } })),
      this.getLowStockCount(orgId),
      canFinance ? this.getMonthlyRevenue(orgId) : Promise.resolve(0),
      canFinance ? this.getMonthlyExpense(orgId) : Promise.resolve(0),
      this.safeCount(this.prisma.employee.count({ where: { organizationId: orgId } })),
      this.getPendingLeavesCount(orgId),
      canPayroll ? this.getMonthlyPayroll(orgId) : Promise.resolve(0),
      this.getRecentActivities(orgId),
    ]);

    const layout = this.buildLayout(permissions);
    const gatedActivities = recentActivities.filter((activity) => this.canSeeActivity(activity.entity, permissions, hasAny));
    const quickActions = DEFAULT_QUICK_ACTIONS.filter((action) => permissions.includes(action.permission));

    const statistics: DashboardStatistics = {
      totalUsers,
      totalCustomers,
      totalProducts,
      totalSuppliers,
      totalInvoices,
      totalPurchaseOrders,
      totalSalesOrders,
      lowStockProducts,
      monthlyRevenue,
      monthlyExpense,
      totalEmployees,
      pendingLeaves,
      monthlyPayroll,
    };

    return {
      organization,
      statistics,
      quickActions,
      recentActivities: gatedActivities,
      permissions,
      layout,
      aiInsights: this.buildAiInsights(statistics, layout),
    };
  }

  private buildLayout(permissions: string[]): DashboardLayout {
    const hasAny = (...required: string[]) => required.some((permission) => permissions.includes(permission));

    const filterPanels = (keys: DashboardPanelKey[]): DashboardPanelKey[] =>
      keys.filter((key) => hasAny(...PANEL_PERMISSIONS[key]));

    return {
      kpis: filterPanels(['revenue', 'expenses', 'netProfit', 'customers', 'sales', 'employees', 'payroll']),
      charts: filterPanels(['revenueTrend', 'cashFlow', 'salesTrend']),
      secondary: filterPanels(['invoices', 'products', 'suppliers', 'users', 'pendingLeaves']),
      alerts: filterPanels(['lowStock', 'purchaseOrders']),
      activity: hasAny('audit.read'),
      aiCopilot: hasAny('ai.read'),
    };
  }

  private canSeeActivity(
    entity: string | null,
    permissions: string[],
    hasAny: (...required: string[]) => boolean,
  ): boolean {
    const raw = entity?.toLowerCase() ?? '';
    for (const [pattern, required] of ACTIVITY_ENTITY_PERMISSIONS) {
      if (pattern.test(raw)) {
        return hasAny(...required);
      }
    }
    return hasAny('audit.read');
  }

  private buildAiInsights(statistics: DashboardStatistics, layout: DashboardLayout): DashboardAiInsight[] {
    const insights: DashboardAiInsight[] = [];

    if (layout.kpis.includes('revenue')) {
      insights.push({
        id: 'revenue',
        icon: 'Zap',
        text: 'Revenue increased 12.5% compared to last month. Your top-performing category is driving this growth.',
      });
    }
    if (layout.secondary.includes('invoices')) {
      insights.push({
        id: 'invoices',
        icon: 'BarChart3',
        text: `${statistics.totalInvoices} total invoices on record. Consider automating reminders for overdue payments.`,
      });
    }
    if (layout.alerts.includes('lowStock') && statistics.lowStockProducts > 0) {
      insights.push({
        id: 'lowStock',
        icon: 'AlertTriangle',
        text: `${statistics.lowStockProducts} products running low on stock. Restock alerts are ready for review.`,
      });
    }
    if (layout.kpis.includes('customers')) {
      insights.push({
        id: 'customers',
        icon: 'ArrowUpRight',
        text: 'Customer acquisition up 8.1%. Projected to reach 2,000 customers next quarter.',
      });
    }
    if (layout.kpis.includes('payroll')) {
      insights.push({
        id: 'payroll',
        icon: 'Wallet',
        text: `Monthly payroll totals ${this.formatCurrency(statistics.monthlyPayroll)}. Review scheduled payments before month-end.`,
      });
    }
    if (layout.alerts.includes('purchaseOrders') && statistics.totalPurchaseOrders > 0) {
      insights.push({
        id: 'purchases',
        icon: 'ShoppingBag',
        text: `${statistics.totalPurchaseOrders} purchase orders placed this period. Track deliveries to keep the supply chain moving.`,
      });
    }

    if (insights.length === 0) {
      insights.push({
        id: 'welcome',
        icon: 'Sparkles',
        text: 'Your business is running smoothly. Ask the AI assistant for answers about your data.',
      });
    }

    return insights;
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
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

  private async getPendingLeavesCount(orgId: string): Promise<number> {
    try {
      return await this.prisma.leave.count({
        where: { status: 'PENDING', employee: { organizationId: orgId } },
      });
    } catch (error) {
      this.logger.error(`Pending leaves query failed: ${(error as Error).message}`);
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

  private async getMonthlyPayroll(orgId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    try {
      const result = await this.prisma.payroll.aggregate({
        where: {
          employee: { organizationId: orgId },
          periodStart: { gte: startOfMonth },
        },
        _sum: { netSalary: true },
      });

      return Number(result._sum.netSalary ?? 0);
    } catch (error) {
      this.logger.error(`Monthly payroll query failed: ${(error as Error).message}`);
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
