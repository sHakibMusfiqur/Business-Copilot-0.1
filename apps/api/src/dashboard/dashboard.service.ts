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

/** Real monthly time-series for the last 12 months, used to render trend charts. */
export interface DashboardTrends {
  labels: string[];
  revenue: number[];
  expenses: number[];
  sales: number[];
  cashFlow: number[];
}

export interface DashboardOverview {
  organization: DashboardOrganization;
  statistics: DashboardStatistics;
  trends: DashboardTrends;
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
    const canSales = hasAny('sales.read', 'invoices.read');

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

    const trends = await this.getTrends(orgId, canFinance, canSales);

    return {
      organization,
      statistics,
      trends,
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
        text: `Monthly revenue totals ${this.formatCurrency(statistics.monthlyRevenue)}. Track the trend chart to monitor this period's performance.`,
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
        text: `${statistics.totalCustomers} customers on record. Reference the customer module for segment and contact details.`,
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

  /** Last 12 month keys in ascending order (YYYY-MM). */
  private monthKeys(): string[] {
    const keys: string[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return keys;
  }

  private trendLabels(): string[] {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return this.monthKeys().map((key) => {
      const [year, month] = key.split('-');
      return `${months[Number(month) - 1]} '${year.slice(2)}`;
    });
  }

  private zeros(): number[] {
    return this.monthKeys().map(() => 0);
  }

  private mergeMonthMap(rows: Array<{ month: string; total: number }>): number[] {
    const byKey = new Map(rows.map((row) => [row.month, Math.round(row.total * 100) / 100]));
    return this.monthKeys().map((key) => byKey.get(key) ?? 0);
  }

  private async revenueTrend(orgId: string): Promise<number[]> {
    const rows = await this.prisma.$queryRaw<Array<{ month: string; total: number }>>`
      SELECT to_char(date_trunc('month', "issueDate"), 'YYYY-MM') AS month,
             (SUM("total"))::float8 AS total
      FROM "Invoice"
      WHERE "organizationId" = ${orgId}
        AND "type" = 'SALES'
        AND "paymentStatus" = 'PAID'
        AND "issueDate" >= date_trunc('month', now()) - INTERVAL '11 months'
      GROUP BY 1
    `;
    return this.mergeMonthMap(rows);
  }

  private async expenseTrend(orgId: string): Promise<number[]> {
    const rows = await this.prisma.$queryRaw<Array<{ month: string; total: number }>>`
      SELECT to_char(date_trunc('month', "orderDate"), 'YYYY-MM') AS month,
             (SUM("total"))::float8 AS total
      FROM "PurchaseOrder"
      WHERE "organizationId" = ${orgId}
        AND "status" <> 'CANCELLED'
        AND "orderDate" >= date_trunc('month', now()) - INTERVAL '11 months'
      GROUP BY 1
    `;
    return this.mergeMonthMap(rows);
  }

  private async salesTrend(orgId: string): Promise<number[]> {
    const rows = await this.prisma.$queryRaw<Array<{ month: string; total: number }>>`
      SELECT to_char(date_trunc('month', "orderDate"), 'YYYY-MM') AS month,
             (COUNT(*)::int)::float8 AS total
      FROM "SalesOrder"
      WHERE "organizationId" = ${orgId}
        AND "status" <> 'CANCELLED'
        AND "orderDate" >= date_trunc('month', now()) - INTERVAL '11 months'
      GROUP BY 1
    `;
    return this.mergeMonthMap(rows);
  }

  private async safeTrend(query: () => Promise<number[]>): Promise<number[]> {
    try {
      return await query();
    } catch (error) {
      this.logger.error(`Dashboard trend query failed: ${(error as Error).message}`);
      return this.zeros();
    }
  }

  private async getTrends(orgId: string, canFinance: boolean, canSales: boolean): Promise<DashboardTrends> {
    const revenue = canFinance ? await this.safeTrend(() => this.revenueTrend(orgId)) : this.zeros();
    const expenses = canFinance ? await this.safeTrend(() => this.expenseTrend(orgId)) : this.zeros();
    const sales = canSales ? await this.safeTrend(() => this.salesTrend(orgId)) : this.zeros();
    const cashFlow = revenue.map((value, index) => Math.round((value - expenses[index]) * 100) / 100);

    return {
      labels: this.trendLabels(),
      revenue,
      expenses,
      sales,
      cashFlow,
    };
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
