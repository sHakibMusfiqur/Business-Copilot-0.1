import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import type { AiIntentKind, AiInsightTable, AiQueryData } from '../ai.types';

export type HasPermission = (permission: string) => boolean;

const CURRENCY = 'USD';


@Injectable()
export class CopilotDataService {
  private readonly logger = new Logger(CopilotDataService.name);

  constructor(private readonly prisma: PrismaService) {}

  async retrieve(
    intent: AiIntentKind,
    orgId: string,
    has: HasPermission,
  ): Promise<AiQueryData> {
    switch (intent) {
      case 'sales_summary':
        return this.salesSummary(orgId, has);
      case 'revenue':
        return this.revenue(orgId, has);
      case 'expenses':
        return this.expenses(orgId, has);
      case 'receivables':
        return this.receivables(orgId, has);
      case 'payables':
        return this.payables(orgId, has);
      case 'inventory':
        return this.inventory(orgId, has);
      case 'customers':
        return this.customers(orgId, has);
      case 'suppliers':
        return this.suppliers(orgId, has);
      case 'trends':
        return this.trends(orgId, has);
      case 'performance':
        return this.performance(orgId, has);
      default:
        return this.notPermitted('general', 'No business data requested');
    }
  }

  private notPermitted(intent: AiIntentKind, reason: string): AiQueryData {
    return { intent, title: reason, permitted: false, currency: CURRENCY };
  }

  private async topCustomersByRevenue(
    orgId: string,
    limit: number,
  ): Promise<AiInsightTable[]> {
    const rows = await this.prisma.$queryRaw<Array<{ name: string; total: number; count: number }>>`
      SELECT COALESCE(c."name", 'Unassigned') AS name,
             (SUM(i."total"))::float8 AS total,
             COUNT(i.id)::int AS count
      FROM "Invoice" i
      LEFT JOIN "Customer" c ON c.id = i."customerId"
      WHERE i."organizationId" = ${orgId} AND i."paymentStatus" = 'PAID' AND i."type" = 'SALES'
      GROUP BY 1
      ORDER BY total DESC
      LIMIT ${limit}
    `;
    return [
      {
        columns: ['Customer', 'Revenue'],
        rows: rows.map((r) => ({
          name: r.name,
          value: r.count.toLocaleString(),
          detail: r.total.toLocaleString(),
        })),
      },
    ];
  }

  private async salesSummary(orgId: string, has: HasPermission): Promise<AiQueryData> {
    if (!has('sales.read') && !has('invoices.read')) {
      return this.notPermitted('sales_summary', 'Sales summary');
    }
    const base = await this.prisma.salesOrder.aggregate({
      where: { organizationId: orgId, status: { not: 'CANCELLED' } },
      _count: { _all: true },
      _sum: { total: true },
    });
    const delivered = await this.prisma.salesOrder.count({
      where: { organizationId: orgId, status: 'DELIVERED' },
    });
    const total = Number(base._sum.total ?? 0);
    return {
      intent: 'sales_summary',
      title: 'Sales summary',
      permitted: true,
      value: total,
      currency: CURRENCY,
      points: [
        { label: 'Orders', value: base._count._all },
        { label: 'Delivered', value: delivered },
      ],
    };
  }

  private async revenue(orgId: string, has: HasPermission): Promise<AiQueryData> {
    if (!has('invoices.read') && !has('accounting.read') && !has('payments.read') && !has('reports.finance')) {
      return this.notPermitted('revenue', 'Revenue');
    }
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const paid = await this.prisma.invoice.aggregate({
      where: { organizationId: orgId, type: 'SALES', paymentStatus: 'PAID' },
      _count: { _all: true },
      _sum: { total: true },
    });
    const monthPaid = await this.prisma.invoice.aggregate({
      where: {
        organizationId: orgId,
        type: 'SALES',
        paymentStatus: 'PAID',
        issueDate: { gte: startOfMonth },
      },
      _sum: { total: true },
    });
    const top = await this.topCustomersByRevenue(orgId, 5);

    return {
      intent: 'revenue',
      title: 'Revenue',
      permitted: true,
      value: Number(paid._sum.total ?? 0),
      currency: CURRENCY,
      points: [
        { label: 'This month', value: Number(monthPaid._sum.total ?? 0) },
        { label: 'Paid invoices', value: paid._count._all },
      ],
      tables: top,
    };
  }

  private async expenses(orgId: string, has: HasPermission): Promise<AiQueryData> {
    if (!has('purchase.read') && !has('accounting.read') && !has('reports.finance')) {
      return this.notPermitted('expenses', 'Expenses');
    }
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const allTime = await this.prisma.purchaseOrder.aggregate({
      where: { organizationId: orgId, status: { not: 'CANCELLED' } },
      _count: { _all: true },
      _sum: { total: true },
    });
    const month = await this.prisma.purchaseOrder.aggregate({
      where: {
        organizationId: orgId,
        orderDate: { gte: startOfMonth },
        status: { not: 'CANCELLED' },
      },
      _sum: { total: true },
    });

    const rows = await this.prisma.$queryRaw<Array<{ name: string; total: number; count: number }>>`
      SELECT COALESCE(s.name, 'Unassigned') AS name,
             (SUM(po."total"))::float8 AS total,
             COUNT(*)::int AS count
      FROM "PurchaseOrder" po
      LEFT JOIN "Supplier" s ON s.id = po."supplierId"
      WHERE po."organizationId" = ${orgId} AND po."status" <> 'CANCELLED'
      GROUP BY 1
      ORDER BY total DESC
      LIMIT 5
    `;

    return {
      intent: 'expenses',
      title: 'Expenses',
      permitted: true,
      value: Number(allTime._sum.total ?? 0),
      currency: CURRENCY,
      points: [
        { label: 'This month', value: Number(month._sum.total ?? 0) },
        { label: 'Purchase orders', value: allTime._count._all },
      ],
      tables: [
        {
          columns: ['Supplier'],
          rows: rows.map((r) => ({
            name: r.name,
            value: r.total.toLocaleString(),
          })),
        },
      ],
    };
  }

  private async receivables(orgId: string, has: HasPermission): Promise<AiQueryData> {
    if (!has('invoices.read') && !has('accounting.receivables.read') && !has('accounting.read')) {
      return this.notPermitted('receivables', 'Receivables');
    }
    const outstanding = await this.prisma.invoice.aggregate({
      where: {
        organizationId: orgId,
        type: 'SALES',
        paymentStatus: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      _count: { _all: true },
      _sum: { total: true },
    });

    const byCustomer = await this.prisma.$queryRaw<Array<{ name: string; total: number; count: number }>>`
      SELECT COALESCE(c."name", 'Unassigned') AS name,
             (SUM(i."total"))::float8 AS total,
             COUNT(*)::int AS count
      FROM "Invoice" i
      LEFT JOIN "Customer" c ON c.id = i."customerId"
      WHERE i."organizationId" = ${orgId}
        AND i."paymentStatus" IN ('PENDING', 'PARTIALLY_PAID', 'OVERDUE')
        AND i."type" = 'SALES'
      GROUP BY 1
      ORDER BY total DESC
      LIMIT 5
    `;

    return {
      intent: 'receivables',
      title: 'Outstanding receivables',
      permitted: true,
      value: Number(outstanding._sum.total ?? 0),
      currency: CURRENCY,
      points: [{ label: 'Open invoices', value: outstanding._count._all }],
      tables: [
        {
          columns: ['Customer'],
          rows: byCustomer.map((r) => ({ name: r.name, value: r.total.toLocaleString() })),
        },
      ],
    };
  }

  private async payables(orgId: string, has: HasPermission): Promise<AiQueryData> {
    if (!has('purchase.read') && !has('accounting.payables.read') && !has('accounting.read')) {
      return this.notPermitted('payables', 'Payables');
    }
    const due = await this.prisma.purchaseOrder.aggregate({
      where: { organizationId: orgId, status: { in: ['PENDING', 'APPROVED'] } },
      _count: { _all: true },
      _sum: { total: true },
    });

    const bySupplier = await this.prisma.$queryRaw<Array<{ name: string; total: number; count: number }>>`
      SELECT COALESCE(s."name", 'Unassigned') AS name,
             (SUM(po."total"))::float8 AS total,
             COUNT(*)::int AS count
      FROM "PurchaseOrder" po
      LEFT JOIN "Supplier" s ON s.id = po."supplierId"
      WHERE po."organizationId" = ${orgId} AND po."status" IN ('PENDING', 'APPROVED')
      GROUP BY 1
      ORDER BY total DESC
      LIMIT 5
    `;

    return {
      intent: 'payables',
      title: 'Payables',
      permitted: true,
      value: Number(due._sum.total ?? 0),
      currency: CURRENCY,
      points: [{ label: 'Open orders', value: due._count._all }],
      tables: [
        {
          columns: ['Supplier'],
          rows: bySupplier.map((r) => ({ name: r.name, value: r.total.toLocaleString() })),
        },
      ],
    };
  }

  private async inventory(orgId: string, has: HasPermission): Promise<AiQueryData> {
    if (!has('inventory.read') && !has('products.read')) {
      return this.notPermitted('inventory', 'Inventory');
    }
    const values = await this.prisma.$queryRaw<Array<{ stockValue: number; lowStockCount: number }>>`
      SELECT COALESCE(SUM(i."quantity" * p."costPrice"), 0)::float8 AS "stockValue",
             COUNT(DISTINCT CASE WHEN i."quantity" <= i."minStock" THEN p.id END)::int AS "lowStockCount"
      FROM "Inventory" i
      INNER JOIN "Product" p ON p.id = i."productId"
      WHERE p."organizationId" = ${orgId}
    `;
    const productCount = await this.prisma.product.count({ where: { organizationId: orgId } });
    const row = values[0] ?? { stockValue: 0, lowStockCount: 0 };

    return {
      intent: 'inventory',
      title: 'Inventory',
      permitted: true,
      value: Math.round(row.stockValue * 100) / 100,
      currency: CURRENCY,
      points: [
        { label: 'Products', value: productCount },
        { label: 'Low stock', value: row.lowStockCount },
      ],
    };
  }

  private async customers(orgId: string, has: HasPermission): Promise<AiQueryData> {
    if (!has('customers.read')) {
      return this.notPermitted('customers', 'Customers');
    }
    const count = await this.prisma.customer.count({ where: { organizationId: orgId } });
    const top = await this.prisma.$queryRaw<Array<{ name: string; total: number; count: number }>>`
      SELECT c."name" AS name,
             (SUM(i."total"))::float8 AS total,
             COUNT(i.id)::int AS count
      FROM "Customer" c
      INNER JOIN "Invoice" i ON i."customerId" = c.id
      WHERE c."organizationId" = ${orgId} AND i."paymentStatus" = 'PAID'
      GROUP BY 1
      ORDER BY total DESC
      LIMIT 5
    `;

    return {
      intent: 'customers',
      title: 'Customers',
      permitted: true,
      value: count,
      currency: CURRENCY,
      tables: [
        {
          columns: ['Customer', 'Revenue'],
          rows: top.map((r) => ({
            name: r.name,
            value: r.count.toLocaleString(),
            detail: r.total.toLocaleString(),
          })),
        },
      ],
    };
  }

  private async suppliers(orgId: string, has: HasPermission): Promise<AiQueryData> {
    if (!has('suppliers.read')) {
      return this.notPermitted('suppliers', 'Suppliers');
    }
    const count = await this.prisma.supplier.count({ where: { organizationId: orgId } });
    const pending = await this.prisma.purchaseOrder.count({
      where: { organizationId: orgId, status: 'PENDING' },
    });

    return {
      intent: 'suppliers',
      title: 'Suppliers',
      permitted: true,
      value: count,
      currency: CURRENCY,
      points: [{ label: 'Pending orders', value: pending }],
    };
  }

  private async trends(orgId: string, has: HasPermission): Promise<AiQueryData> {
    if (!has('invoices.read') && !has('accounting.read') && !has('reports.finance')) {
      return this.notPermitted('trends', 'Trends');
    }
    const revenueRows = await this.prisma.$queryRaw<Array<{ month: string; total: number }>>`
      SELECT to_char(date_trunc('month', "issueDate"), 'YYYY-MM') AS month,
             (SUM("total"))::float8 AS total
      FROM "Invoice"
      WHERE "organizationId" = ${orgId} AND "type" = 'SALES' AND "paymentStatus" = 'PAID'
        AND "issueDate" >= date_trunc('month', now()) - INTERVAL '11 months'
      GROUP BY 1
    `;
    const expenseRows = await this.prisma.$queryRaw<Array<{ month: string; total: number }>>`
      SELECT to_char(date_trunc('month', "orderDate"), 'YYYY-MM') AS month,
             (SUM("total"))::float8 AS total
      FROM "PurchaseOrder"
      WHERE "organizationId" = ${orgId} AND "status" <> 'CANCELLED'
        AND "orderDate" >= date_trunc('month', now()) - INTERVAL '11 months'
      GROUP BY 1
    `;

    return {
      intent: 'trends',
      title: 'Revenue & expense trend (12 months)',
      permitted: true,
      currency: CURRENCY,
      points: [
        ...revenueRows.map((r) => ({ label: r.month, value: Math.round(r.total * 100) / 100 })),
      ],
      tables: [
        {
          columns: ['Revenue'],
          rows: revenueRows.map((r) => ({ name: r.month, value: r.total.toLocaleString() })),
        },
        {
          columns: ['Expenses'],
          rows: expenseRows.map((r) => ({ name: r.month, value: r.total.toLocaleString() })),
        },
      ],
    };
  }

  private async performance(orgId: string, has: HasPermission): Promise<AiQueryData> {
    const canFinance =
      has('invoices.read') || has('accounting.read') || has('payments.read') || has('reports.finance');
    if (!canFinance) {
      return this.notPermitted('performance', 'Business performance');
    }
    const [revenue, expenses] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { organizationId: orgId, type: 'SALES', paymentStatus: 'PAID' },
        _sum: { total: true },
      }),
      this.prisma.purchaseOrder.aggregate({
        where: { organizationId: orgId, status: { not: 'CANCELLED' } },
        _sum: { total: true },
      }),
    ]);

    const totalRevenue = Number(revenue._sum.total ?? 0);
    const totalExpenses = Number(expenses._sum.total ?? 0);
    const net = Math.round((totalRevenue - totalExpenses) * 100) / 100;

    return {
      intent: 'performance',
      title: 'Business performance',
      permitted: true,
      value: net,
      currency: CURRENCY,
      summaryLines: [
        `Net profit: ${net.toLocaleString()}`,
        `Revenue: ${totalRevenue.toLocaleString()}`,
        `Expenses: ${totalExpenses.toLocaleString()}`,
      ],
    };
  }
}