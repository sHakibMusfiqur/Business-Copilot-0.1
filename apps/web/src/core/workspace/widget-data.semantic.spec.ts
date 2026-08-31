import { describe, expect, it } from 'vitest';

import { resolveWidgetData, emptyStatistics } from './widget-data';
import type { DashboardOverview, DashboardStatistics } from '@/components/dashboard/types';

function makeStats(overrides: Partial<DashboardStatistics> = {}): DashboardStatistics {
  return { ...emptyStatistics(), ...overrides };
}

function makeOverview(stats: DashboardStatistics): DashboardOverview {
  return {
    organization: { id: 'org-1', name: 'Test Org', logo: null, createdAt: '' },
    statistics: stats,
    trends: { labels: [], revenue: [], expenses: [], sales: [], cashFlow: [] },
    quickActions: [],
    recentActivities: [],
    permissions: [],
    layout: { kpis: [], charts: [], secondary: [], alerts: [], activity: false, aiCopilot: false },
    aiInsights: [],
  };
}

describe('Semantic dashboard correctness', () => {
  describe('REAL_CONFIRMED metrics remain available', () => {
    const stats = makeStats({
      totalCustomers: 42,
      totalEmployees: 10,
      monthlyRevenue: 50000,
      monthlyExpense: 30000,
      lowStockProducts: 3,
      pendingLeaves: 2,
      monthlyPayroll: 25000,
      totalUsers: 15,
    });

    it('monthlyRevenue maps correctly', () => {
      const data = resolveWidgetData('monthlyRevenue', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(true);
      expect(data.metric?.value).toBe(50000);
      expect(data.metric?.available).toBe(true);
    });

    it('totalCustomers maps correctly', () => {
      const data = resolveWidgetData('totalCustomers', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(true);
      expect(data.metric?.value).toBe(42);
      expect(data.metric?.available).toBe(true);
    });

    it('employees maps correctly', () => {
      const data = resolveWidgetData('employees', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(true);
      expect(data.metric?.value).toBe(10);
    });

    it('expenditure maps correctly', () => {
      const data = resolveWidgetData('expenditure', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(true);
      expect(data.metric?.value).toBe(30000);
    });

    it('netProfit is derived correctly', () => {
      const data = resolveWidgetData('netProfit', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(true);
      expect(data.metric?.value).toBe(20000);
    });

    it('lowStock maps correctly', () => {
      const data = resolveWidgetData('lowStock', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(true);
      expect(data.metric?.value).toBe(3);
    });

    it('pendingLeaves maps correctly', () => {
      const data = resolveWidgetData('pendingLeaves', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(true);
      expect(data.metric?.value).toBe(2);
    });

    it('monthlyPayroll maps correctly', () => {
      const data = resolveWidgetData('monthlyPayroll', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(true);
      expect(data.metric?.value).toBe(25000);
    });

    it('teamSize maps to totalUsers', () => {
      const data = resolveWidgetData('teamSize', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(true);
      expect(data.metric?.value).toBe(15);
    });
  });

  describe('Semantically wrong metrics are unavailable', () => {
    const stats = makeStats({
      totalCustomers: 42,
      totalProducts: 100,
      totalSalesOrders: 25,
      totalPurchaseOrders: 8,
      totalInvoices: 50,
      monthlyRevenue: 50000,
      monthlyExpense: 30000,
      totalEmployees: 10,
      pendingLeaves: 2,
      totalUsers: 15,
    });

    it('todaySales is unavailable (monthlyRevenue ≠ today sales)', () => {
      const data = resolveWidgetData('todaySales', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
      expect(data.metric?.available).toBe(false);
    });

    it('openOrders is unavailable (totalSalesOrders ≠ open orders)', () => {
      const data = resolveWidgetData('openOrders', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('appointmentsToday is unavailable (totalCustomers ≠ appointments)', () => {
      const data = resolveWidgetData('appointmentsToday', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('productionOutput is unavailable (totalProducts ≠ production output)', () => {
      const data = resolveWidgetData('productionOutput', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('workOrders is unavailable (totalPurchaseOrders ≠ work orders)', () => {
      const data = resolveWidgetData('workOrders', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('enrolled is unavailable (totalCustomers ≠ students)', () => {
      const data = resolveWidgetData('enrolled', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('feesCollected is unavailable (revenue ≠ school fees)', () => {
      const data = resolveWidgetData('feesCollected', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('monthlyRecurringRevenue is unavailable (revenue ≠ MRR)', () => {
      const data = resolveWidgetData('monthlyRecurringRevenue', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('posSalesToday is unavailable (revenue ≠ today POS)', () => {
      const data = resolveWidgetData('posSalesToday', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('transactions is unavailable (totalSalesOrders ≠ transactions)', () => {
      const data = resolveWidgetData('transactions', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('productsInStock is unavailable (totalProducts ≠ stock on hand)', () => {
      const data = resolveWidgetData('productsInStock', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('prescriptionsToday is unavailable (totalCustomers ≠ prescriptions)', () => {
      const data = resolveWidgetData('prescriptionsToday', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('stockValue is unavailable (expense ≠ inventory value)', () => {
      const data = resolveWidgetData('stockValue', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('dailyRevenue is unavailable (revenue ≠ daily revenue)', () => {
      const data = resolveWidgetData('dailyRevenue', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('orderBook is unavailable (totalSalesOrders ≠ open order book)', () => {
      const data = resolveWidgetData('orderBook', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('fabricStock is unavailable (totalProducts ≠ fabric inventory)', () => {
      const data = resolveWidgetData('fabricStock', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('monthlyRetainer is unavailable (revenue ≠ retainer income)', () => {
      const data = resolveWidgetData('monthlyRetainer', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('cashBalance is unavailable (netProfit ≠ cash position)', () => {
      const data = resolveWidgetData('cashBalance', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('outstanding is unavailable (totalInvoices ≠ unpaid invoices)', () => {
      const data = resolveWidgetData('outstanding', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('pipeline is unavailable (totalSalesOrders ≠ CRM pipeline)', () => {
      const data = resolveWidgetData('pipeline', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('organizations is unavailable (hardcoded 1)', () => {
      const data = resolveWidgetData('organizations', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('activeOrgs is unavailable (hardcoded 1)', () => {
      const data = resolveWidgetData('activeOrgs', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('aiTokens is unavailable (hardcoded 0)', () => {
      const data = resolveWidgetData('aiTokens', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('platformRevenue is unavailable (org revenue ≠ platform revenue)', () => {
      const data = resolveWidgetData('platformRevenue', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('averageTicket is unavailable (revenue/orders ≠ per-ticket average)', () => {
      const data = resolveWidgetData('averageTicket', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('avgOrderValue is unavailable (revenue/orders ≠ order value)', () => {
      const data = resolveWidgetData('avgOrderValue', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('costPerUnit is unavailable (expense/products ≠ manufacturing cost)', () => {
      const data = resolveWidgetData('costPerUnit', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });
  });

  describe('Zero vs unavailable', () => {
    it('real zero value stays zero (not unavailable)', () => {
      const stats = makeStats({ totalCustomers: 0 });
      const data = resolveWidgetData('totalCustomers', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(true);
      expect(data.metric?.value).toBe(0);
      expect(data.metric?.available).toBe(true);
    });

    it('unavailable metric returns null value with available=false', () => {
      const stats = makeStats({ totalCustomers: 50 });
      const data = resolveWidgetData('todaySales', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
      expect(data.metric?.value).toBeNull();
    });
  });

  describe('Trend integrity', () => {
    it('revenue trend uses real backend time-series', () => {
      const stats = makeStats();
      const overview = makeOverview(stats);
      overview.trends = {
        labels: ['Jan', 'Feb'],
        revenue: [1000, 2000],
        expenses: [500, 800],
        sales: [10, 15],
        cashFlow: [500, 1200],
      };
      const data = resolveWidgetData('revenueTrend', overview, '#3B82F6');
      expect(data.series?.available).toBe(true);
      expect(data.series?.data).toEqual([1000, 2000]);
    });

    it('non-existent trend source is unavailable (no series produced)', () => {
      const stats = makeStats();
      const overview = makeOverview(stats);
      const data = resolveWidgetData('dailySales', overview, '#3B82F6');
      expect(data.series).toBeUndefined();
      expect(data.available).toBeFalsy();
    });

    it('appointments trend is unavailable (no backend source)', () => {
      const stats = makeStats();
      const overview = makeOverview(stats);
      const data = resolveWidgetData('appointments', overview, '#3B82F6');
      expect(data.series).toBeUndefined();
      expect(data.available).toBeFalsy();
    });

    it('production trend is unavailable (no backend source)', () => {
      const stats = makeStats();
      const overview = makeOverview(stats);
      const data = resolveWidgetData('production', overview, '#3B82F6');
      expect(data.series).toBeUndefined();
      expect(data.available).toBeFalsy();
    });

    it('enrollment trend is unavailable (no backend source)', () => {
      const stats = makeStats();
      const overview = makeOverview(stats);
      const data = resolveWidgetData('enrollment', overview, '#3B82F6');
      expect(data.series).toBeUndefined();
      expect(data.available).toBeFalsy();
    });

    it('recurringRevenue trend is unavailable (no backend source)', () => {
      const stats = makeStats();
      const overview = makeOverview(stats);
      const data = resolveWidgetData('recurringRevenue', overview, '#3B82F6');
      expect(data.series).toBeUndefined();
      expect(data.available).toBeFalsy();
    });
  });

  describe('Distribution integrity', () => {
    it('customers distribution is unavailable (single segment not meaningful)', () => {
      const stats = makeStats({ totalCustomers: 42 });
      const data = resolveWidgetData('customers', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
      expect(data.distribution).toEqual([]);
    });

    it('menuMix distribution is unavailable (no category data)', () => {
      const stats = makeStats();
      const data = resolveWidgetData('menuMix', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
      expect(data.distribution).toEqual([]);
    });

    it('departments distribution is unavailable (no department breakdown)', () => {
      const stats = makeStats({ totalEmployees: 10 });
      const data = resolveWidgetData('departments', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
      expect(data.distribution).toEqual([]);
    });

    it('categorySales distribution is unavailable (no category data)', () => {
      const stats = makeStats({ totalProducts: 100 });
      const data = resolveWidgetData('categorySales', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
      expect(data.distribution).toEqual([]);
    });

    it('quality distribution is unavailable', () => {
      const stats = makeStats();
      const data = resolveWidgetData('quality', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('deployments distribution is unavailable', () => {
      const stats = makeStats();
      const data = resolveWidgetData('deployments', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });
  });

  describe('Approval integrity', () => {
    it('approvals title is "Pending Leave Reviews"', () => {
      const stats = makeStats({ pendingLeaves: 3 });
      const data = resolveWidgetData('approvals', makeOverview(stats), '#3B82F6');
      expect(data.title).toBe('Pending Leave Reviews');
    });

    it('approvals only includes pending leaves (actual approval items)', () => {
      const stats = makeStats({ pendingLeaves: 3, totalPurchaseOrders: 10, totalInvoices: 20 });
      const data = resolveWidgetData('approvals', makeOverview(stats), '#3B82F6');
      expect(data.approvals).toHaveLength(1);
      expect(data.approvals?.[0].title).toBe('Leave request');
    });

    it('approvals does not include totalPurchaseOrders as approval items', () => {
      const stats = makeStats({ pendingLeaves: 0, totalPurchaseOrders: 10 });
      const data = resolveWidgetData('approvals', makeOverview(stats), '#3B82F6');
      expect(data.approvals).toHaveLength(0);
    });

    it('approvals does not include totalInvoices as approval items', () => {
      const stats = makeStats({ pendingLeaves: 0, totalInvoices: 20 });
      const data = resolveWidgetData('approvals', makeOverview(stats), '#3B82F6');
      expect(data.approvals).toHaveLength(0);
    });

    it('approvals is empty when no pending leaves', () => {
      const stats = makeStats({ pendingLeaves: 0 });
      const data = resolveWidgetData('approvals', makeOverview(stats), '#3B82F6');
      expect(data.approvals).toHaveLength(0);
      expect(data.available).toBe(false);
    });
  });

  describe('List widget integrity', () => {
    it('recentOrders is unavailable (only activity may use audit data)', () => {
      const stats = makeStats();
      const overview = makeOverview(stats);
      overview.recentActivities = [
        { id: '1', action: 'Created invoice', entity: 'Invoice', entityId: null, user: { id: 'u1', name: 'John', email: 'j@t.com' }, createdAt: '2026-01-01T00:00:00Z' },
      ];
      const data = resolveWidgetData('recentOrders', overview, '#3B82F6');
      expect(data.rows).toEqual([]);
      expect(data.available).toBe(false);
    });

    it('kitchenQueue is empty (no backend source)', () => {
      const data = resolveWidgetData('kitchenQueue', makeOverview(makeStats()), '#3B82F6');
      expect(data.rows).toEqual([]);
    });

    it('medicineStock is empty (no backend source)', () => {
      const data = resolveWidgetData('medicineStock', makeOverview(makeStats()), '#3B82F6');
      expect(data.rows).toEqual([]);
    });

    it('machineStatus is empty (no backend source)', () => {
      const data = resolveWidgetData('machineStatus', makeOverview(makeStats()), '#3B82F6');
      expect(data.rows).toEqual([]);
    });

    it('pullRequests is empty (no backend source)', () => {
      const data = resolveWidgetData('pullRequests', makeOverview(makeStats()), '#3B82F6');
      expect(data.rows).toEqual([]);
    });

    it('openTickets is unavailable (no backend source)', () => {
      const data = resolveWidgetData('openTickets', makeOverview(makeStats()), '#3B82F6');
      expect(data.rows).toEqual([]);
      expect(data.available).toBe(false);
    });

    it('ordersQueue is empty (audit entries are not queue items)', () => {
      const data = resolveWidgetData('ordersQueue', makeOverview(makeStats()), '#3B82F6');
      expect(data.rows).toEqual([]);
    });
  });

  describe('Operational signals', () => {
    it('signals is undefined for empty org', () => {
      const stats = makeStats();
      const data = resolveWidgetData('healthScore', makeOverview(stats), '#3B82F6');
      expect(data.signals).toBeUndefined();
      expect(data.available).toBe(false);
    });

    it('signals contains operational signals for org with data', () => {
      const stats = makeStats({ totalCustomers: 10, lowStockProducts: 2, pendingLeaves: 1 });
      const data = resolveWidgetData('healthScore', makeOverview(stats), '#3B82F6');
      expect(data.signals).toBeDefined();
      expect(data.signals?.some(s => s.key === 'lowStock')).toBe(true);
      expect(data.signals?.some(s => s.key === 'pendingLeaves')).toBe(true);
      expect(data.available).toBe(true);
    });

    it('signals array has no arbitrary score', () => {
      const stats = makeStats({ totalCustomers: 10, lowStockProducts: 5 });
      const data = resolveWidgetData('healthScore', makeOverview(stats), '#3B82F6');
      expect(data.signals).toBeDefined();
      expect(data.signals?.every(s => typeof s.value === 'number')).toBe(true);
      expect(data.signals?.every(s => s.key && s.label)).toBe(true);
    });
  });

  describe('Platform metrics unavailable', () => {
    it('organizations is unavailable (hardcoded 1)', () => {
      const data = resolveWidgetData('organizations', makeOverview(makeStats()), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('activeOrgs is unavailable (hardcoded 1)', () => {
      const data = resolveWidgetData('activeOrgs', makeOverview(makeStats()), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('aiTokens is unavailable (hardcoded 0)', () => {
      const data = resolveWidgetData('aiTokens', makeOverview(makeStats()), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('platformRevenue is unavailable (org ≠ platform)', () => {
      const data = resolveWidgetData('platformRevenue', makeOverview(makeStats()), '#3B82F6');
      expect(data.available).toBe(false);
    });
  });

  describe('Cash balance and outstanding', () => {
    it('cashBalance is unavailable (netProfit ≠ cash position)', () => {
      const stats = makeStats({ monthlyRevenue: 10000, monthlyExpense: 5000 });
      const data = resolveWidgetData('cashBalance', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });

    it('outstanding is unavailable (totalInvoices ≠ unpaid amount)', () => {
      const stats = makeStats({ totalInvoices: 50 });
      const data = resolveWidgetData('outstanding', makeOverview(stats), '#3B82F6');
      expect(data.available).toBe(false);
    });
  });

  describe('Forecast', () => {
    it('forecast is unavailable (no forecast algorithm)', () => {
      const stats = makeStats({ monthlyRevenue: 10000 });
      const overview = makeOverview(stats);
      overview.trends = { labels: ['Jan'], revenue: [10000], expenses: [5000], sales: [10], cashFlow: [5000] };
      const data = resolveWidgetData('forecast', overview, '#3B82F6');
      expect(data.available).toBe(false);
    });
  });

  describe('Tenant isolation', () => {
    it('null overview returns unavailable (not zero)', () => {
      const data = resolveWidgetData('monthlyRevenue', null, '#3B82F6');
      expect(data.metric?.value).toBeNull();
      expect(data.metric?.available).toBe(false);
      expect(data.available).toBe(false);
    });
  });

  describe('Calendar', () => {
    it('calendar is unavailable (no backend source)', () => {
      const data = resolveWidgetData('calendar', makeOverview(makeStats()), '#3B82F6');
      expect(data.available).toBe(false);
      expect(data.calendar).toEqual([]);
    });
  });

  describe('Activity semantics', () => {
    it('activity uses audit data with truthful labels', () => {
      const stats = makeStats();
      const overview = makeOverview(stats);
      overview.recentActivities = [
        { id: '1', action: 'Created invoice', entity: 'Invoice', entityId: null, user: { id: 'u1', name: 'John', email: 'j@t.com' }, createdAt: '2026-01-01T00:00:00Z' },
      ];
      const data = resolveWidgetData('activity', overview, '#3B82F6');
      expect(data.rows).toHaveLength(1);
      expect(data.rows?.[0].title).toBe('Created invoice');
      expect(data.rows?.[0].subtitle).toBe('Invoice');
      expect(data.available).toBe(true);
    });

    it('activity is available even with empty recentActivities', () => {
      const data = resolveWidgetData('activity', makeOverview(makeStats()), '#3B82F6');
      expect(data.available).toBe(true);
      expect(data.rows).toEqual([]);
    });
  });

  describe('AI insights', () => {
    it('ai insights come from backend only', () => {
      const stats = makeStats();
      const overview = makeOverview(stats);
      overview.aiInsights = [
        { id: '1', icon: 'sparkles', text: 'Revenue is trending up' },
      ];
      const data = resolveWidgetData('aiInsights', overview, '#3B82F6');
      expect(data.ai).toEqual(['Revenue is trending up']);
      expect(data.available).toBe(true);
    });

    it('ai insights is available with empty backend array', () => {
      const data = resolveWidgetData('aiInsights', makeOverview(makeStats()), '#3B82F6');
      expect(data.ai).toEqual([]);
      expect(data.available).toBe(true);
    });
  });

  describe('Trend zero values', () => {
    it('real zero-valued trend is available', () => {
      const stats = makeStats();
      const overview = makeOverview(stats);
      overview.trends = {
        labels: ['Jan', 'Feb'],
        revenue: [0, 0],
        expenses: [0, 0],
        sales: [0, 0],
        cashFlow: [0, 0],
      };
      const data = resolveWidgetData('revenueTrend', overview, '#3B82F6');
      expect(data.series?.available).toBe(true);
      expect(data.series?.data).toEqual([0, 0]);
    });

    it('missing trend data is unavailable', () => {
      const stats = makeStats();
      const overview = makeOverview(stats);
      overview.trends = { labels: [], revenue: [], expenses: [], sales: [], cashFlow: [] };
      const data = resolveWidgetData('revenueTrend', overview, '#3B82F6');
      expect(data.series?.available).toBe(false);
      expect(data.series?.data).toEqual([]);
    });
  });

  describe('List empty vs unavailable', () => {
    it('activity with empty list is available (backend source exists)', () => {
      const data = resolveWidgetData('activity', makeOverview(makeStats()), '#3B82F6');
      expect(data.available).toBe(true);
      expect(data.rows).toEqual([]);
    });

    it('recentOrders is unavailable (no backend source)', () => {
      const data = resolveWidgetData('recentOrders', makeOverview(makeStats()), '#3B82F6');
      expect(data.available).toBe(false);
      expect(data.rows).toEqual([]);
    });
  });

  describe('Accent propagation', () => {
    it('unavailable metric preserves accent', () => {
      const data = resolveWidgetData('todaySales', makeOverview(makeStats()), '#FF5500');
      expect(data.accent).toBe('#FF5500');
    });

    it('unavailable series preserves accent', () => {
      const data = resolveWidgetData('forecast', makeOverview(makeStats()), '#00FF55');
      expect(data.accent).toBe('#00FF55');
    });

    it('unavailable distribution preserves accent', () => {
      const data = resolveWidgetData('customers', makeOverview(makeStats()), '#5500FF');
      expect(data.accent).toBe('#5500FF');
    });

    it('unavailable list preserves accent', () => {
      const data = resolveWidgetData('recentOrders', makeOverview(makeStats()), '#FF0055');
      expect(data.accent).toBe('#FF0055');
    });

    it('null overview preserves accent', () => {
      const data = resolveWidgetData('monthlyRevenue', null, '#AABBCC');
      expect(data.accent).toBe('#AABBCC');
    });
  });

  describe('Metric label precision', () => {
    it('monthlyRevenue label is "Monthly Revenue"', () => {
      const data = resolveWidgetData('monthlyRevenue', makeOverview(makeStats()), '#3B82F6');
      expect(data.metric?.label).toBe('Monthly Revenue');
    });

    it('expenditure label is "Monthly Expenditure"', () => {
      const data = resolveWidgetData('expenditure', makeOverview(makeStats()), '#3B82F6');
      expect(data.metric?.label).toBe('Monthly Expenditure');
    });

    it('netProfit label is "Monthly Net Profit"', () => {
      const data = resolveWidgetData('netProfit', makeOverview(makeStats()), '#3B82F6');
      expect(data.metric?.label).toBe('Monthly Net Profit');
    });

    it('pendingLeaves label is "Pending Leave Requests"', () => {
      const data = resolveWidgetData('pendingLeaves', makeOverview(makeStats()), '#3B82F6');
      expect(data.metric?.label).toBe('Pending Leave Requests');
    });

    it('monthlyPayroll label is "Monthly Payroll"', () => {
      const data = resolveWidgetData('monthlyPayroll', makeOverview(makeStats()), '#3B82F6');
      expect(data.metric?.label).toBe('Monthly Payroll');
    });

    it('teamCost label is "Monthly Payroll"', () => {
      const data = resolveWidgetData('teamCost', makeOverview(makeStats()), '#3B82F6');
      expect(data.metric?.label).toBe('Monthly Payroll');
    });
  });
});
