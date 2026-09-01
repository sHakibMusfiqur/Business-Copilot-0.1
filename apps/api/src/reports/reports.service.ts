import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSalesSummary(orgId: string, query?: { startDate?: string; endDate?: string }) {
    const where: Record<string, unknown> = { organizationId: orgId };

    if (query?.startDate || query?.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        (where.createdAt as Record<string, unknown>).gte = new Date(query.startDate);
      }
      if (query.endDate) {
        (where.createdAt as Record<string, unknown>).lte = new Date(query.endDate);
      }
    }

    const [totalOrders, byStatus, totalRevenue] = await Promise.all([
      this.prisma.salesOrder.count({ where }),
      this.prisma.salesOrder.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
        _sum: { total: true },
      }),
      this.prisma.salesOrder.aggregate({
        where: { ...where, status: { in: ['CONFIRMED', 'DELIVERED'] } },
        _sum: { total: true },
      }),
    ]);

    return {
      totalOrders,
      totalRevenue: Number(totalRevenue._sum.total ?? 0),
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
        total: Number(s._sum.total ?? 0),
      })),
    };
  }

  async getPurchaseSummary(orgId: string, query?: { startDate?: string; endDate?: string }) {
    const where: Record<string, unknown> = { organizationId: orgId };

    if (query?.startDate || query?.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        (where.createdAt as Record<string, unknown>).gte = new Date(query.startDate);
      }
      if (query.endDate) {
        (where.createdAt as Record<string, unknown>).lte = new Date(query.endDate);
      }
    }

    const [totalOrders, byStatus, totalCost] = await Promise.all([
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
        _sum: { total: true },
      }),
      this.prisma.purchaseOrder.aggregate({
        where: { ...where, status: { in: ['APPROVED', 'RECEIVED'] } },
        _sum: { total: true },
      }),
    ]);

    return {
      totalOrders,
      totalCost: Number(totalCost._sum.total ?? 0),
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
        total: Number(s._sum.total ?? 0),
      })),
    };
  }

  async getInventorySummary(orgId: string) {
    const [totalProducts, inventoryStats] = await Promise.all([
      this.prisma.product.count({ where: { organizationId: orgId, isActive: true } }),
      this.prisma.inventory.aggregate({
        where: { product: { organizationId: orgId } },
        _sum: { quantity: true },
        _count: { id: true },
      }),
    ]);

    return {
      totalProducts,
      totalInventoryItems: inventoryStats._count.id,
      totalQuantity: Number(inventoryStats._sum.quantity ?? 0),
    };
  }

  async getAccountingSummary(orgId: string) {
    const [totalAccounts, journalEntries, receivables, payables] = await Promise.all([
      this.prisma.account.count({ where: { organizationId: orgId } }),
      this.prisma.journalEntry.count({ where: { organizationId: orgId } }),
      this.prisma.receivable.aggregate({
        where: { organizationId: orgId },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      this.prisma.payable.aggregate({
        where: { organizationId: orgId },
        _sum: { totalAmount: true, paidAmount: true },
      }),
    ]);

    const totalReceivable = Number(receivables._sum.totalAmount ?? 0);
    const paidReceivable = Number(receivables._sum.paidAmount ?? 0);
    const totalPayable = Number(payables._sum.totalAmount ?? 0);
    const paidPayable = Number(payables._sum.paidAmount ?? 0);

    return {
      totalAccounts,
      totalJournalEntries: journalEntries,
      accountsReceivable: totalReceivable - paidReceivable,
      accountsPayable: totalPayable - paidPayable,
      netPosition: (totalReceivable - paidReceivable) - (totalPayable - paidPayable),
    };
  }

  async getEmployeeSummary(orgId: string) {
    const [totalEmployees, activeEmployees, byDepartmentRaw, recentHires] = await Promise.all([
      this.prisma.employee.count({ where: { organizationId: orgId } }),
      this.prisma.employee.count({ where: { organizationId: orgId, isActive: true } }),
      this.prisma.employee.groupBy({
        by: ['departmentId'],
        where: { organizationId: orgId, isActive: true },
        _count: { id: true },
      }),
      this.prisma.employee.findMany({
        where: { organizationId: orgId },
        orderBy: { hireDate: 'desc' },
        take: 5,
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          hireDate: true,
          position: true,
          department: { select: { name: true } },
        },
      }),
    ]);

    const departmentIds = byDepartmentRaw
      .map((d) => d.departmentId)
      .filter((id): id is string => id !== null);

    const departments = departmentIds.length > 0
      ? await this.prisma.department.findMany({
          where: { id: { in: departmentIds }, organizationId: orgId },
          select: { id: true, name: true },
        })
      : [];

    const departmentMap = new Map(departments.map((d) => [d.id, d.name]));

    const byDepartment = byDepartmentRaw.map((d) => ({
      departmentId: d.departmentId,
      departmentName: d.departmentId ? (departmentMap.get(d.departmentId) ?? 'Unknown') : 'Unassigned',
      count: d._count.id,
    }));

    return {
      totalEmployees,
      activeEmployees,
      inactiveEmployees: totalEmployees - activeEmployees,
      byDepartment,
      recentHires,
    };
  }

  async getDashboardOverview(orgId: string) {
    const [sales, purchases, employees] = await Promise.all([
      this.getSalesSummary(orgId),
      this.getPurchaseSummary(orgId),
      this.getEmployeeSummary(orgId),
    ]);

    return {
      sales,
      purchases,
      employees,
      generatedAt: new Date().toISOString(),
    };
  }
}
