import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../infrastructure/redis/redis.service';

import { DEFAULT_QUICK_ACTIONS } from './quick-actions.config';
import type { QuickAction } from './quick-actions.config';
import { DashboardConfigService, type ResolvedDashboardConfig } from './dashboard-config.service';
import {
  buildQueryPlan,
  type QueryPlan,
  type QueryGroup,
} from './dashboard-query-planner';

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

// ─── Per-Group Cached Data ─────────────────────────────────────────────────────

/**
 * Partial data structure for a single cached group.
 * Each group stores only the fields it owns.
 */
interface CachedGroupData {
  // Sales group
  totalSalesOrders?: number;
  todaySales?: number;
  todayOrders?: number;
  todayRevenue?: number;
  pendingOrders?: number;
  completedOrders?: number;
  cancelledOrders?: number;
  averageOrderValue?: number;
  topSellingProducts?: Array<{ name: string; quantity: number; revenue: number }>;
  recentOrders?: Array<{ id: string; number: string; total: number; status: string; date: Date }>;
  salesTrend?: number[];
  // Inventory group
  totalProducts?: number;
  lowStockProducts?: number;
  lowStockCount?: number;
  inventoryValue?: number;
  // Customers group
  totalCustomers?: number;
  newCustomersThisMonth?: number;
  // Employees group
  totalEmployees?: number;
  // Leaves group
  pendingLeaves?: number;
  // Payroll group
  monthlyPayroll?: number;
  // Finance group
  totalInvoices?: number;
  totalPurchaseOrders?: number;
  monthlyRevenue?: number;
  monthlyExpense?: number;
  todayExpenses?: number;
  revenueTrend?: number[];
  expenseTrend?: number[];
  // Audit group
  recentActivities?: RecentActivityItem[];
  // People group
  totalUsers?: number;
  totalSuppliers?: number;
}

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

    // Always activate the people group for basic org stats (users, suppliers)
    // when the user has the required permission.
    if (!queryPlan.people && permissions.includes('users.read')) {
      queryPlan.people = true;
      queryPlan.activeGroupCount++;
    }

    this.logger.debug(
      `Dashboard plan: industry=${dashboardConfig.industry} widgets=${dashboardConfig.allWidgets.length} ` +
      `groups=${queryPlan.activeGroupCount} [${Object.entries(queryPlan.activeSourcesByGroup)
        .filter(([, sources]) => sources.length > 0)
        .map(([group, sources]) => `${group}(${sources.length})`)
        .join(', ')}]`,
    );

    // Fetch organization metadata (always safe, always cached).
    const organization = await this.getOrganization(orgId, dashboardConfig.industry);

    // Fetch each active group from cache or DB, respecting permissions.
    const groupData = await this.fetchActiveGroups(orgId, permissions, queryPlan);

    // Assemble the full response from cached group data.
    const statistics = this.assembleStatistics(groupData);
    const industryMetrics = this.assembleIndustryMetrics(groupData);
    const trends = this.assembleTrends(groupData, queryPlan);
    const recentActivities = groupData.recentActivities ?? [];

    const hasAny = (...required: string[]) => required.some((permission) => permissions.includes(permission));
    const gatedActivities = recentActivities.filter((activity) => this.canSeeActivity(activity.entity, permissions, hasAny));
    const quickActions = DEFAULT_QUICK_ACTIONS.filter((action) => permissions.includes(action.permission));

    return {
      organization,
      statistics,
      industryMetrics,
      dashboardConfig,
      trends,
      quickActions,
      recentActivities: gatedActivities,
      permissions,
      aiInsights: this.buildAiInsights(statistics, dashboardConfig, permissions),
    };
  }

  // ─── Per-Group Cache + Fetch ────────────────────────────────────────────────

  /**
   * Fetch data for each active group, using cache where possible.
   * Only groups that are both active in the plan AND authorized by permissions are fetched.
   * Returns a merged CachedGroupData with all fetched fields.
   */
  private async fetchActiveGroups(
    orgId: string,
    permissions: string[],
    plan: QueryPlan,
  ): Promise<CachedGroupData> {
    const hasAny = (...required: string[]): boolean =>
      required.some((p) => permissions.includes(p));

    const result: CachedGroupData = {};
    const fetchedGroups: string[] = [];
    const cachedGroups: string[] = [];

    // Define which groups are permission-gated and their required permissions
    const groupAuth: Record<QueryGroup, string[]> = {
      sales:     ['sales.read', 'invoices.read'],
      inventory: ['inventory.read'],
      customers: ['customers.read'],
      employees: ['employees.read'],
      leaves:    ['employees.read'],
      payroll:   ['payroll.read'],
      finance:   ['invoices.read', 'payments.read', 'accounting.read', 'reports.finance', 'purchase.read'],
      audit:     ['audit.read'],
      people:    ['users.read'],
    };

    const fetchGroup = async (group: QueryGroup): Promise<void> => {
      // Check if group is active in plan
      if (!plan[group]) return;

      // Check permission
      const perms = groupAuth[group];
      if (perms.length > 0 && !hasAny(...perms)) return;

      // Check cache
      const cacheKey = this.redis.organizationKey(orgId, `dashboard:${group}`);
      const cached = await this.redis.get<CachedGroupData>(cacheKey);

      if (cached) {
        Object.assign(result, cached);
        cachedGroups.push(group);
        return;
      }

      // Cache miss — fetch from DB
      const data = await this.fetchGroupData(orgId, group);
      if (data && Object.keys(data).length > 0) {
        await this.redis.set(cacheKey, data, { ttlSeconds: DashboardService.CACHE_TTL });
        Object.assign(result, data);
        fetchedGroups.push(group);
      }
    };

    // Fetch all active groups in parallel
    const allGroups: QueryGroup[] = ['sales', 'inventory', 'customers', 'employees', 'leaves', 'payroll', 'finance', 'audit', 'people'];
    await Promise.all(allGroups.map((g) => fetchGroup(g)));

    this.logger.debug(
      `Dashboard cache: fetched=[${fetchedGroups.join(',')}] cached=[${cachedGroups.join(',')}]`,
    );

    return result;
  }

  /**
   * Fetch data for a single query group from the database.
   * Returns only the fields owned by that group.
   */
  private async fetchGroupData(orgId: string, group: QueryGroup): Promise<CachedGroupData> {
    switch (group) {
      case 'sales':     return this.fetchSalesGroup(orgId);
      case 'inventory': return this.fetchInventoryGroup(orgId);
      case 'customers': return this.fetchCustomersGroup(orgId);
      case 'employees': return this.fetchEmployeesGroup(orgId);
      case 'leaves':    return this.fetchLeavesGroup(orgId);
      case 'payroll':   return this.fetchPayrollGroup(orgId);
      case 'finance':   return this.fetchFinanceGroup(orgId);
      case 'audit':     return this.fetchAuditGroup(orgId);
      case 'people':    return this.fetchPeopleGroup(orgId);
      default:          return {};
    }
  }

  // ─── Group Fetchers ─────────────────────────────────────────────────────────

  private async fetchSalesGroup(orgId: string): Promise<CachedGroupData> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      todaySalesRevenue,
      todaySalesCount,
      pendingOrdersCount,
      completedOrdersCount,
      cancelledOrdersCount,
      topSellingProducts,
      recentOrders,
      totalSalesOrders,
      salesTrend,
    ] = await Promise.all([
      this.safeNumber(this.prisma.invoice.aggregate({
        where: { organizationId: orgId, type: 'SALES', paymentStatus: 'PAID', issueDate: { gte: startOfDay } },
        _sum: { total: true },
      }).then((r) => Number(r._sum.total ?? 0))),
      this.safeCount(this.prisma.salesOrder.count({
        where: { organizationId: orgId, orderDate: { gte: startOfDay } },
      })),
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
      this.safeCount(this.prisma.salesOrder.count({ where: { organizationId: orgId } })),
      this.safeTrend(() => this.salesTrend(orgId)),
    ]);

    const averageOrderValue = todaySalesCount > 0
      ? Math.round((todaySalesRevenue / todaySalesCount) * 100) / 100
      : 0;

    return {
      totalSalesOrders,
      todaySales: todaySalesCount,
      todayOrders: todaySalesCount,
      todayRevenue: todaySalesRevenue,
      pendingOrders: pendingOrdersCount,
      completedOrders: completedOrdersCount,
      cancelledOrders: cancelledOrdersCount,
      averageOrderValue,
      topSellingProducts,
      recentOrders,
      salesTrend,
    };
  }

  private async fetchInventoryGroup(orgId: string): Promise<CachedGroupData> {
    const [lowStockCount, inventoryValue, totalProducts] = await Promise.all([
      this.getLowStockCount(orgId),
      this.safeNumber(this.prisma.inventory.aggregate({
        where: { organizationId: orgId },
        _sum: { quantity: true },
      }).then((r) => Number(r._sum.quantity ?? 0))),
      this.safeCount(this.prisma.product.count({ where: { organizationId: orgId } })),
    ]);

    return { totalProducts, lowStockProducts: lowStockCount, lowStockCount, inventoryValue };
  }

  private async fetchCustomersGroup(orgId: string): Promise<CachedGroupData> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [totalCustomers, newCustomersThisMonth] = await Promise.all([
      this.safeCount(this.prisma.customer.count({ where: { organizationId: orgId } })),
      this.safeCount(this.prisma.customer.count({
        where: { organizationId: orgId, createdAt: { gte: startOfMonth } },
      })),
    ]);

    return { totalCustomers, newCustomersThisMonth };
  }

  private async fetchEmployeesGroup(orgId: string): Promise<CachedGroupData> {
    const totalEmployees = await this.safeCount(
      this.prisma.employee.count({ where: { organizationId: orgId } }),
    );
    return { totalEmployees };
  }

  private async fetchLeavesGroup(orgId: string): Promise<CachedGroupData> {
    const pendingLeaves = await this.getPendingLeavesCount(orgId);
    return { pendingLeaves };
  }

  private async fetchPayrollGroup(orgId: string): Promise<CachedGroupData> {
    const monthlyPayroll = await this.getMonthlyPayroll(orgId);
    return { monthlyPayroll };
  }

  private async fetchFinanceGroup(orgId: string): Promise<CachedGroupData> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      totalInvoices,
      totalPurchaseOrders,
      monthlyRevenue,
      monthlyExpense,
      todayExpenses,
      revenueTrend,
      expenseTrend,
    ] = await Promise.all([
      this.safeCount(this.prisma.invoice.count({ where: { organizationId: orgId } })),
      this.safeCount(this.prisma.purchaseOrder.count({ where: { organizationId: orgId } })),
      this.getMonthlyRevenue(orgId),
      this.getMonthlyExpense(orgId),
      this.safeNumber(this.prisma.purchaseOrder.aggregate({
        where: { organizationId: orgId, orderDate: { gte: startOfDay }, status: { not: 'CANCELLED' } },
        _sum: { total: true },
      }).then((r) => Number(r._sum.total ?? 0))),
      this.safeTrend(() => this.revenueTrend(orgId)),
      this.safeTrend(() => this.expenseTrend(orgId)),
    ]);

    return {
      totalInvoices,
      totalPurchaseOrders,
      monthlyRevenue,
      monthlyExpense,
      todayExpenses,
      revenueTrend,
      expenseTrend,
    };
  }

  private async fetchAuditGroup(orgId: string): Promise<CachedGroupData> {
    const recentActivities = await this.getRecentActivities(orgId);
    return { recentActivities };
  }

  private async fetchPeopleGroup(orgId: string): Promise<CachedGroupData> {
    const [totalUsers, totalSuppliers] = await Promise.all([
      this.safeCount(this.prisma.user.count({ where: { organizationId: orgId } })),
      this.safeCount(this.prisma.supplier.count({ where: { organizationId: orgId, isActive: true, deletedAt: null } })),
    ]);
    return { totalUsers, totalSuppliers };
  }

  // ─── Response Assembly ──────────────────────────────────────────────────────

  /** Assemble DashboardStatistics from cached group data. Fields default to 0. */
  private assembleStatistics(data: CachedGroupData): DashboardStatistics {
    return {
      totalUsers: data.totalUsers ?? 0,
      totalCustomers: data.totalCustomers ?? 0,
      totalProducts: data.totalProducts ?? 0,
      totalSuppliers: data.totalSuppliers ?? 0,
      totalInvoices: data.totalInvoices ?? 0,
      totalPurchaseOrders: data.totalPurchaseOrders ?? 0,
      totalSalesOrders: data.totalSalesOrders ?? 0,
      lowStockProducts: data.lowStockProducts ?? 0,
      monthlyRevenue: data.monthlyRevenue ?? 0,
      monthlyExpense: data.monthlyExpense ?? 0,
      totalEmployees: data.totalEmployees ?? 0,
      pendingLeaves: data.pendingLeaves ?? 0,
      monthlyPayroll: data.monthlyPayroll ?? 0,
    };
  }

  /** Assemble IndustryMetrics from cached group data. Fields default to 0/[]. */
  private assembleIndustryMetrics(data: CachedGroupData): IndustryMetrics {
    return {
      todaySales: data.todaySales ?? 0,
      todayOrders: data.todayOrders ?? 0,
      todayRevenue: data.todayRevenue ?? 0,
      todayExpenses: data.todayExpenses ?? 0,
      pendingOrders: data.pendingOrders ?? 0,
      completedOrders: data.completedOrders ?? 0,
      cancelledOrders: data.cancelledOrders ?? 0,
      averageOrderValue: data.averageOrderValue ?? 0,
      lowStockCount: data.lowStockCount ?? 0,
      inventoryValue: data.inventoryValue ?? 0,
      newCustomersThisMonth: data.newCustomersThisMonth ?? 0,
      topSellingProducts: data.topSellingProducts ?? [],
      recentOrders: data.recentOrders ?? [],
    };
  }

  /** Assemble DashboardTrends from cached group data. Fields default to zeros. */
  private assembleTrends(data: CachedGroupData, plan: QueryPlan): DashboardTrends {
    const labels = this.trendLabels();
    const zeros = labels.map(() => 0);

    const revenue = plan.finance ? (data.revenueTrend ?? zeros) : zeros;
    const expenses = plan.finance ? (data.expenseTrend ?? zeros) : zeros;
    const sales = plan.sales ? (data.salesTrend ?? zeros) : zeros;
    const cashFlow = revenue.map((value, index) => Math.round((value - expenses[index]) * 100) / 100);

    return { labels, revenue, expenses, sales, cashFlow };
  }

  // ─── Activity Permission Check ──────────────────────────────────────────────

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

  // ─── AI Insights (Permission-Gated) ─────────────────────────────────────────

  /**
   * Build AI insights. Each insight is only generated if:
   * 1. The relevant widget ID is in the dashboard config, AND
   * 2. The user has permission to see the underlying data (field was queried).
   *
   * Fields that were not queried (group inactive) default to 0, so insights
   * that check `> 0` naturally won't fire for unauthorized data.
   */
  private buildAiInsights(
    statistics: DashboardStatistics,
    config: ResolvedDashboardConfig,
    permissions: string[],
  ): DashboardAiInsight[] {
    const insights: DashboardAiInsight[] = [];
    const widgetIds = new Set(config.allWidgets.map((w) => w.id));
    const has = (...perms: string[]): boolean => perms.some((p) => permissions.includes(p));

    // Revenue insight — only if user has finance permissions AND revenue was queried
    if (widgetIds.has('revenueTrend') && has(...FINANCE_PERMISSIONS) && statistics.monthlyRevenue > 0) {
      insights.push({
        id: 'revenue',
        icon: 'Zap',
        text: `Monthly revenue totals ${this.formatCurrency(statistics.monthlyRevenue)}. Track the trend chart to monitor this period's performance.`,
      });
    }

    // Invoice insight — only if user has finance permissions AND invoices were queried
    if (has(...FINANCE_PERMISSIONS) && statistics.totalInvoices > 0) {
      insights.push({
        id: 'invoices',
        icon: 'BarChart3',
        text: `${statistics.totalInvoices} total invoices on record. Consider automating reminders for overdue payments.`,
      });
    }

    // Low stock insight — only if user has inventory permissions AND low stock was queried
    if (widgetIds.has('lowStock') && has('inventory.read') && statistics.lowStockProducts > 0) {
      insights.push({
        id: 'lowStock',
        icon: 'AlertTriangle',
        text: `${statistics.lowStockProducts} products running low on stock. Restock alerts are ready for review.`,
      });
    }

    // Customer insight — only if user has customer permissions AND customers were queried
    if (has('customers.read') && statistics.totalCustomers > 0) {
      insights.push({
        id: 'customers',
        icon: 'ArrowUpRight',
        text: `${statistics.totalCustomers} customers on record. Reference the customer module for segment and contact details.`,
      });
    }

    // Payroll insight — only if user has payroll permissions AND payroll was queried
    if (has('payroll.read') && statistics.monthlyPayroll > 0) {
      insights.push({
        id: 'payroll',
        icon: 'Wallet',
        text: `Monthly payroll totals ${this.formatCurrency(statistics.monthlyPayroll)}. Review scheduled payments before month-end.`,
      });
    }

    // Purchase insight — only if user has purchase permissions AND purchases were queried
    if (has('purchase.read') && statistics.totalPurchaseOrders > 0) {
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

  // ─── Organization (reads settings once, reuses industry from config) ────────

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

  /**
   * Get organization metadata. Accepts pre-resolved industry to avoid
   * duplicate OrganizationSettings query (DashboardConfigService already read it).
   */
  private async getOrganization(orgId: string, industry: IndustryKey | null): Promise<DashboardOrganization> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, logo: true, createdAt: true },
    });

    return {
      id: org?.id ?? '',
      name: org?.name ?? 'Unknown',
      logo: org?.logo ?? null,
      createdAt: org?.createdAt ?? new Date(),
      industry,
    };
  }

  // ─── Individual Query Helpers ───────────────────────────────────────────────

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
