import type { BillingInterval, SubscriptionPlanResponse } from '@/lib/api';

export type { BillingInterval } from '@/lib/api';

export function getPlanPrice(plan: SubscriptionPlanResponse, interval: BillingInterval): number {
  if (interval === 'YEARLY' && plan.yearlyPrice !== null && plan.yearlyPrice !== undefined) {
    return plan.yearlyPrice;
  }
  return plan.price;
}

export function formatPrice(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPlanPrice(plan: SubscriptionPlanResponse, interval: BillingInterval): string {
  return formatPrice(getPlanPrice(plan, interval), plan.currency);
}

export function formatStorage(mb: number): string {
  if (mb >= 1024) return `${Math.round(mb / 1024)} GB`;
  return `${mb} MB`;
}

export function formatUsers(users: number): string {
  if (users >= 999) return 'Unlimited';
  return `${users}`;
}

export const MODULE_LABELS: Record<string, string> = {
  invoicing: 'Invoicing',
  expenses: 'Expense Tracking',
  reports: 'Reports',
  basicReports: 'Basic Reports',
  advancedReports: 'Advanced Reports',
  inventory: 'Inventory',
  crm: 'CRM',
  api: 'API Access',
  multiWarehouse: 'Multi-Warehouse',
  sales: 'Sales',
  purchases: 'Purchases',
  accounting: 'Accounting',
  payroll: 'Payroll',
};

export function moduleLabel(module: string): string {
  return MODULE_LABELS[module] ?? module.charAt(0).toUpperCase() + module.slice(1).replace(/([A-Z])/g, ' $1');
}
