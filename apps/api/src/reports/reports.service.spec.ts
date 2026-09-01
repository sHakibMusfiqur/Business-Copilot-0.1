import { Test, TestingModule } from '@nestjs/testing';

import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  beforeEach(async () => {
    prisma = {
      salesOrder: {
        count: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
      purchaseOrder: {
        count: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
      product: {
        count: jest.fn(),
      },
      inventory: {
        aggregate: jest.fn(),
      },
      account: {
        count: jest.fn(),
      },
      journalEntry: {
        count: jest.fn(),
      },
      receivable: {
        aggregate: jest.fn(),
      },
      payable: {
        aggregate: jest.fn(),
      },
      employee: {
        count: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn(),
      },
      department: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSalesSummary', () => {
    it('should return sales summary', async () => {
      prisma.salesOrder.count.mockResolvedValue(10);
      prisma.salesOrder.groupBy.mockResolvedValue([
        { status: 'CONFIRMED', _count: { id: 5 }, _sum: { total: 25000 } },
        { status: 'DELIVERED', _count: { id: 5 }, _sum: { total: 25000 } },
      ]);
      prisma.salesOrder.aggregate.mockResolvedValue({ _sum: { total: 50000 } });

      const result = await service.getSalesSummary('org-1');

      expect(result.totalOrders).toBe(10);
      expect(result.totalRevenue).toBe(50000);
      expect(result.byStatus).toHaveLength(2);
    });

    it('should filter by date range', async () => {
      prisma.salesOrder.count.mockResolvedValue(0);
      prisma.salesOrder.groupBy.mockResolvedValue([]);
      prisma.salesOrder.aggregate.mockResolvedValue({ _sum: { total: 0 } });

      await service.getSalesSummary('org-1', { startDate: '2026-01-01', endDate: '2026-01-31' });
      expect(prisma.salesOrder.count).toHaveBeenCalled();
    });
  });

  describe('getPurchaseSummary', () => {
    it('should return purchase summary', async () => {
      prisma.purchaseOrder.count.mockResolvedValue(8);
      prisma.purchaseOrder.groupBy.mockResolvedValue([
        { status: 'APPROVED', _count: { id: 3 }, _sum: { total: 15000 } },
        { status: 'RECEIVED', _count: { id: 5 }, _sum: { total: 25000 } },
      ]);
      prisma.purchaseOrder.aggregate.mockResolvedValue({ _sum: { total: 40000 } });

      const result = await service.getPurchaseSummary('org-1');

      expect(result.totalOrders).toBe(8);
      expect(result.totalCost).toBe(40000);
      expect(result.byStatus).toHaveLength(2);
    });
  });

  describe('getInventorySummary', () => {
    it('should return inventory summary', async () => {
      prisma.product.count.mockResolvedValue(50);
      prisma.inventory.aggregate.mockResolvedValue({ _sum: { quantity: 1000 }, _count: { id: 200 } });

      const result = await service.getInventorySummary('org-1');

      expect(result.totalProducts).toBe(50);
      expect(result.totalInventoryItems).toBe(200);
      expect(result.totalQuantity).toBe(1000);
    });
  });

  describe('getAccountingSummary', () => {
    it('should return accounting summary', async () => {
      prisma.account.count.mockResolvedValue(20);
      prisma.journalEntry.count.mockResolvedValue(50);
      prisma.receivable.aggregate.mockResolvedValue({ _sum: { totalAmount: 100000, paidAmount: 60000 } });
      prisma.payable.aggregate.mockResolvedValue({ _sum: { totalAmount: 50000, paidAmount: 30000 } });

      const result = await service.getAccountingSummary('org-1');

      expect(result.totalAccounts).toBe(20);
      expect(result.totalJournalEntries).toBe(50);
      expect(result.accountsReceivable).toBe(40000);
      expect(result.accountsPayable).toBe(20000);
      expect(result.netPosition).toBe(20000);
    });
  });

  describe('getEmployeeSummary', () => {
    it('should return employee summary with department names', async () => {
      prisma.employee.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(8);
      prisma.employee.groupBy.mockResolvedValue([
        { departmentId: 'dept-1', _count: { id: 5 } },
        { departmentId: 'dept-2', _count: { id: 3 } },
      ]);
      prisma.employee.findMany.mockResolvedValue([
        { id: '1', employeeCode: 'EMP-0001', firstName: 'John', lastName: 'Doe', hireDate: new Date(), position: 'Developer', department: { name: 'Engineering' } },
      ]);
      prisma.department.findMany.mockResolvedValue([
        { id: 'dept-1', name: 'Engineering' },
        { id: 'dept-2', name: 'Marketing' },
      ]);

      const result = await service.getEmployeeSummary('org-1');

      expect(result.totalEmployees).toBe(10);
      expect(result.activeEmployees).toBe(8);
      expect(result.inactiveEmployees).toBe(2);
      expect(result.byDepartment).toHaveLength(2);
      expect(result.byDepartment[0].departmentName).toBe('Engineering');
      expect(result.byDepartment[1].departmentName).toBe('Marketing');
      expect(result.recentHires).toHaveLength(1);
    });

    it('should handle null departmentId as Unassigned', async () => {
      prisma.employee.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(5);
      prisma.employee.groupBy.mockResolvedValue([
        { departmentId: null, _count: { id: 5 } },
      ]);
      prisma.employee.findMany.mockResolvedValue([]);
      prisma.department.findMany.mockResolvedValue([]);

      const result = await service.getEmployeeSummary('org-1');

      expect(result.byDepartment[0].departmentName).toBe('Unassigned');
    });
  });

  describe('getDashboardOverview', () => {
    it('should return overview with sales, purchases, and employees', async () => {
      prisma.salesOrder.count.mockResolvedValue(10);
      prisma.salesOrder.groupBy.mockResolvedValue([]);
      prisma.salesOrder.aggregate.mockResolvedValue({ _sum: { total: 50000 } });
      prisma.purchaseOrder.count.mockResolvedValue(8);
      prisma.purchaseOrder.groupBy.mockResolvedValue([]);
      prisma.purchaseOrder.aggregate.mockResolvedValue({ _sum: { total: 40000 } });
      prisma.employee.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(8);
      prisma.employee.groupBy.mockResolvedValue([]);
      prisma.employee.findMany.mockResolvedValue([]);
      prisma.department.findMany.mockResolvedValue([]);

      const result = await service.getDashboardOverview('org-1');

      expect(result.sales).toBeDefined();
      expect(result.purchases).toBeDefined();
      expect(result.employees).toBeDefined();
      expect(result.generatedAt).toBeDefined();
    });
  });
});
