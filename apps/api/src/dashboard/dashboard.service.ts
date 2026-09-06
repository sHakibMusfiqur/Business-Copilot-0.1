import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../infrastructure/redis/redis.service';

import { DEFAULT_QUICK_ACTIONS } from './quick-actions.config';
import type { QuickAction } from './quick-actions.config';
import { DashboardConfigService, type ResolvedDashboardConfig } from './dashboard-config.service';
import {
  buildQueryPlan,
  type QueryPlan,
} from './dashboard-query-planner';

const VALID_INDUSTRY_KEYS = new Set([
  'restaurant', 'hospital', 'manufacturing', 'school', 'software',
  'retail', 'pharmacy', 'garments', 'it-services', 'general',
]);

export type IndustryKey =
  | 'restaurant' | 'hospital' | 'manufacturing' | 'school' | 'software'
  | 'retail' | 'pharmacy' | 'garments' | 'it-services' | 'general';

export interface DashboardOrganization {
  id: string;
  name: string;
  logo: string | null;
  createdAt: Date;
  industry: IndustryKey | null;
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

export interface IndustryMetrics {
  todaySales: number;
  todayOrders: number;
  todayRevenue: number;
  todayExpenses: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
  lowStockCount: number;
  inventoryValue: number;
  newCustomersThisMonth: number;
  topSellingProducts: Array<{ name: string; quantity: number; revenue: number }>;
  recentOrders: Array<{ id: string; number: string; total: number; status: string; date: Date }>;
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
  industryMetrics: IndustryMetrics;
  dashboardConfig: ResolvedDashboardConfig;
  trends: DashboardTrends;
  quickActions: QuickAction[];
  recentActivities: RecentActivityItem[];
  permissions: string[];
  aiInsights: DashboardAiInsight[];
}

/**
 * Permissions that grant access to the finance view of the dashboard. Finance
 * aggregates (revenue / expenses / net profit) are only computed for users that
 * hold any of these.
 */
const FINANCE_PERMISSIONS = ['invoices.read', 'payments.read', 'accounting.read', 'reports.finance'];

/** Org-level data that is the same for all users in an organization. Cached in Redis. */
interface OrgLevelData {
  organization: DashboardOrganization;
  statistics: DashboardStatistics;
  industryMetrics: IndustryMetrics;
  trends: DashboardTrends;
  recentActivities: RecentActivityItem[];
}

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
  private static readonly CACHE_TTL = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly configService: DashboardConfigService,
  ) {}

  async getOverview(
    orgId: string,
    userId: string,
    permissions: string[],
    enabledModules: string[] = [],
  ): Promise<DashboardOverview> {
    await this.validateOrgMembership(orgId, userId);

    // Resolve dashboard config first — it determines which sources (and thus queries) are needed.
    const dashboardConfig = await this.configService.resolveConfig(orgId, permissions, enabledModules);

    // Build query plan from resolved config — only groups with active sources are queried.
    const queryPlan = buildQueryPlan(dashboardConfig.requiredSources, permissions);

    this.logger.debug(
      `Dashboard plan: industry=${dashboardConfig.industry} widgets=${dashboardConfig.allWidgets.length} ` +
      `groups=${queryPlan.activeGroupCount} [${Object.entries(queryPlan.activeSourcesByGroup)
        .filter(([, sources]) => sources.length > 0)
        .map(([group, sources]) => `${group}(${sources.length})`)
        .join(', ')}]`,
    );

    // Cache only org-level data (same for all users in the org).
    // dashboardConfig is resolved per-request because it depends on user permissions + modules.
    const cacheKey = this.redis.organizationKey(orgId, 'dashboard:orgdata');
    const cached = await this.redis.get<OrgLevelData>(cacheKey);
    const orgData = cached ?? await this.fetchOrgLevelData(orgId, permissions, queryPlan);

    if (!cached) {
      await this.redis.set(cacheKey, orgData, { ttlSeconds: DashboardService.CACHE_TTL });
    }

    const hasAny = (...required: string[]) => required.some((permission) => permissions.includes(permission));
    const gatedActivities = orgData.recentActivities.filter((activity) => this.canSeeActivity(activity.entity, permissions, hasAny));
    const quickActions = DEFAULT_QUICK_ACTIONS.filter((action) => permissions.includes(action.permission));

    return {
      organization: orgData.organization,
      statistics: orgData.statistics,
      industryMetrics: orgData.industryMetrics,
      dashboardConfig,
      trends: orgData.trends,
      quickActions,
      recentActivities: gatedActivities,
      permissions,
      aiInsights: this.buildAiInsights(orgData.statistics, dashboardConfig),
    };
  }

  /** Fetch org-level data, respecting the query plan. Only active groups are queried. */
  private async fetchOrgLevelData(orgId: string, permissions: string[], plan: QueryPlan): Promise<OrgLevelData> {
    const hasAny = (...required: string[]) => required.some((permission) => permissions.includes(permission));
    const canFinance = hasAny(...FINANCE_PERMISSIONS);

    // ── Organization (always queried) ──────────────────────────────────────────
    const organization = await this.getOrganization(orgId);

    // ── Statistics: basic counts are always queried (cheap), extended stats are plan-gated ──
    const [
      totalUsers,
      totalCustomers,
      totalProducts,
      totalSuppliers,
      totalInvoices,
      totalPurchaseOrders,
      totalSalesOrders,
    ] = await Promise.all([
      this.safeCount(this.prisma.user.count({ where: { organizationId: orgId } })),
      this.safeCount(this.prisma.customer.count({ where: { organizationId: orgId } })),
      this.safeCount(this.prisma.product.count({ where: { organizationId: orgId } })),
      this.safeCount(this.prisma.supplier.count({ where: { organizationId: orgId } })),
      this.safeCount(this.prisma.invoice.count({ where: { organizationId: orgId } })),
      this.safeCount(this.prisma.purchaseOrder.count({ where: { organizationId: orgId } })),
      this.safeCount(this.prisma.salesOrder.count({ where: { organizationId: orgId } })),
    ]);

    // Extended stats — only query if the relevant group is active
    const [lowStockProducts, monthlyRevenue, monthlyExpense, totalEmployees, pendingLeaves, monthlyPayroll] =
      await Promise.all([
        plan.inventory ? this.getLowStockCount(orgId) : Promise.resolve(0),
        plan.finance && canFinance ? this.getMonthlyRevenue(orgId) : Promise.resolve(0),
        plan.finance && canFinance ? this.getMonthlyExpense(orgId) : Promise.resolve(0),
        plan.employees ? this.safeCount(this.prisma.employee.count({ where: { organizationId: orgId } })) : Promise.resolve(0),
        plan.leaves ? this.getPendingLeavesCount(orgId) : Promise.resolve(0),
        plan.payroll ? this.getMonthlyPayroll(orgId) : Promise.resolve(0),
      ]);

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

    // ── Industry metrics: only query groups that are active in the plan ─────────
    const industryMetrics = await this.getIndustryMetricsByPlan(orgId, plan);

    // ── Trends: only query finance/sales trends if their groups are active ──────
    const trends = await this.getTrendsByPlan(orgId, plan, canFinance);

    // ── Recent activities: only query if audit group is active ──────────────────
    const recentActivities = plan.audit
      ? await this.getRecentActivities(orgId)
      : [];

    return {
      organization,
      statistics,
      industryMetrics,
      trends,
      recentActivities,
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

  private buildAiInsights(statistics: DashboardStatistics, config: ResolvedDashboardConfig): DashboardAiInsight[] {
    const insights: DashboardAiInsight[] = [];
    const widgetIds = new Set(config.allWidgets.map((w) => w.id));

    if (widgetIds.has('revenueTrend')) {
      insights.push({
        id: 'revenue',
        icon: 'Zap',
        text: `Monthly revenue totals ${this.formatCurrency(statistics.monthlyRevenue)}. Track the trend chart to monitor this period's performance.`,
      });
    }
    if (statistics.totalInvoices > 0) {
      insights.push({
        id: 'invoices',
        icon: 'BarChart3',
        text: `${statistics.totalInvoices} total invoices on record. Consider automating reminders for overdue payments.`,
      });
    }
    if (widgetIds.has('lowStock') && statistics.lowStockProducts > 0) {
      insights.push({
        id: 'lowStock',
        icon: 'AlertTriangle',
        text: `${statistics.lowStockProducts} products running low on stock. Restock alerts are ready for review.`,
      });
    }
    if (statistics.totalCustomers > 0) {
      insights.push({
        id: 'customers',
        icon: 'ArrowUpRight',
        text: `${statistics.totalCustomers} customers on record. Reference the customer module for segment and contact details.`,
      });
    }
    if (statistics.monthlyPayroll > 0) {
      insights.push({
        id: 'payroll',
        icon: 'Wallet',
        text: `Monthly payroll totals ${this.formatCurrency(statistics.monthlyPayroll)}. Review scheduled payments before month-end.`,
      });
    }
    if (statistics.totalPurchaseOrders > 0) {
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
    const [org, settings] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true, name: true, logo: true, createdAt: true },
      }),
      this.prisma.organizationSettings.findUnique({
        where: { organizationId: orgId },
        select: { settings: true },
      }),
    ]);

    let industry: IndustryKey | null = null;
    if (settings?.settings && typeof settings.settings === 'object') {
      const raw = (settings.settings as Record<string, unknown>).industry;
      if (typeof raw === 'string' && VALID_INDUSTRY_KEYS.has(raw)) {
        industry = raw as IndustryKey;
      }
    }

    return {
      id: org?.id ?? '',
      name: org?.name ?? 'Unknown',
      logo: org?.logo ?? null,
      createdAt: org?.createdAt ?? new Date(),
      industry,
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

  /** Build industry metrics by querying only the groups active in the plan. */
  private async getIndustryMetricsByPlan(orgId: string, plan: QueryPlan): Promise<IndustryMetrics> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // ── Sales group queries ────────────────────────────────────────────────────
    const [todaySalesRevenue, todaySalesCount, todayOrdersCount, todayExpenseTotal,
      pendingOrdersCount, completedOrdersCount, cancelledOrdersCount,
      topSellingProducts, recentOrders] = plan.sales
      ? await Promise.all([
          this.safeNumber(this.prisma.invoice.aggregate({
            where: { organizationId: orgId, type: 'SALES', paymentStatus: 'PAID', issueDate: { gte: startOfDay } },
            _sum: { total: true },
          }).then((r) => Number(r._sum.total ?? 0))),
          this.safeCount(this.prisma.salesOrder.count({
            where: { organizationId: orgId, orderDate: { gte: startOfDay } },
          })),
          this.safeCount(this.prisma.salesOrder.count({
            where: { organizationId: orgId, orderDate: { gte: startOfDay } },
          })),
          this.safeNumber(this.prisma.purchaseOrder.aggregate({
            where: { organizationId: orgId, orderDate: { gte: startOfDay }, status: { not: 'CANCELLED' } },
            _sum: { total: true },
          }).then((r) => Number(r._sum.total ?? 0))),
          this.safeCount(this.prisma.salesOrder.count({
            where: { organizationId: orgId, status: 'PENDING' },
          })),
          this.safeCount(this.prisma.salesOrder.count({
            where: { organizationId: orgId, status: 'DELIVERED' },
          })),
          this.safeCount(this.prisma.salesOrder.count({
            where: { organizationId: orgId, status: 'CANCELLED' },
          })),
          this.getTopSellingProducts(orgId),
          this.getRecentOrders(orgId),
        ])
      : [0, 0, 0, 0, 0, 0, 0, [], []];

    // ── Inventory group queries ────────────────────────────────────────────────
    const [lowStockCount, inventoryValue] = plan.inventory
      ? await Promise.all([
          this.getLowStockCount(orgId),
          this.safeNumber(this.prisma.inventory.aggregate({
            where: { organizationId: orgId },
            _sum: { quantity: true },
          }).then((r) => Number(r._sum.quantity ?? 0))),
        ])
      : [0, 0];

    // ── Customers group queries ────────────────────────────────────────────────
    const newCustomersThisMonth = plan.customers
      ? await this.safeCount(this.prisma.customer.count({
          where: { organizationId: orgId, createdAt: { gte: startOfMonth } },
        }))
      : 0;

    const averageOrderValue = todaySalesCount > 0
      ? Math.round((todaySalesRevenue / todaySalesCount) * 100) / 100
      : 0;

    return {
      todaySales: todaySalesCount,
      todayOrders: todayOrdersCount,
      todayRevenue: todaySalesRevenue,
      todayExpenses: todayExpenseTotal,
      pendingOrders: pendingOrdersCount,
      completedOrders: completedOrdersCount,
      cancelledOrders: cancelledOrdersCount,
      averageOrderValue,
      lowStockCount,
      inventoryValue,
      newCustomersThisMonth,
      topSellingProducts,
      recentOrders,
    };
  }

  private async getTopSellingProducts(orgId: string): Promise<Array<{ name: string; quantity: number; revenue: number }>> {
    try {
      const rows = await this.prisma.$queryRaw<Array<{ name: string; quantity: bigint; revenue: number }>>`
        SELECT p."name" as name,
               SUM(COALESCE(soi.quantity, 0))::bigint as quantity,
               SUM(COALESCE(soi."lineTotal", 0))::float8 as revenue
        FROM "SalesOrderItem" soi
        INNER JOIN "Product" p ON p.id = soi."productId"
        INNER JOIN "SalesOrder" so ON so.id = soi."salesOrderId"
        WHERE so."organizationId" = ${orgId}
          AND so."status" <> 'CANCELLED'
        GROUP BY p."name"
        ORDER BY quantity DESC
        LIMIT 5
      `;
      return rows.map((r) => ({ name: r.name, quantity: Number(r.quantity), revenue: Math.round(r.revenue * 100) / 100 }));
    } catch (error) {
      this.logger.error(`Top selling products query failed: ${(error as Error).message}`);
      return [];
    }
  }

  private async getRecentOrders(orgId: string): Promise<Array<{ id: string; number: string; total: number; status: string; date: Date }>> {
    try {
      const rows = await this.prisma.salesOrder.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, orderNumber: true, total: true, status: true, orderDate: true },
      });
      return rows.map((r) => ({
        id: r.id,
        number: r.orderNumber,
        total: Number(r.total),
        status: r.status,
        date: r.orderDate,
      }));
    } catch (error) {
      this.logger.error(`Recent orders query failed: ${(error as Error).message}`);
      return [];
    }
  }

  private async safeNumber(query: Promise<number>): Promise<number> {
    try {
      return await query;
    } catch (error) {
      this.logger.error(`Dashboard number query failed: ${(error as Error).message}`);
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

  /** Build trends by querying only the groups active in the plan. */
  private async getTrendsByPlan(orgId: string, plan: QueryPlan, canFinance: boolean): Promise<DashboardTrends> {
    const [revenue, expenses, sales] = await Promise.all([
      plan.finance && canFinance ? this.safeTrend(() => this.revenueTrend(orgId)) : Promise.resolve(this.zeros()),
      plan.finance && canFinance ? this.safeTrend(() => this.expenseTrend(orgId)) : Promise.resolve(this.zeros()),
      plan.sales ? this.safeTrend(() => this.salesTrend(orgId)) : Promise.resolve(this.zeros()),
    ]);
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
