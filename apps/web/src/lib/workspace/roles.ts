import {
  Crown,
  User,
  Briefcase,
  Landmark,
  Wallet,
  Users2,
  Target,
  Boxes,
  Headset,
  Building,
  Eye,
} from 'lucide-react';

import type { RoleKey, RoleProfile, WidgetDefinition } from './types';

const baseFinanceWidgets: WidgetDefinition[] = [
  { key: 'metricCurrency', zone: 'hero', span: 3, source: 'monthlyRevenue', permission: ['invoices.read', 'accounting.read', 'payments.read'] },
  { key: 'metricCurrency', zone: 'hero', span: 3, source: 'netProfit', permission: ['invoices.read', 'accounting.read', 'payments.read'] },
  { key: 'metricCurrency', zone: 'hero', span: 3, source: 'cashBalance', permission: ['invoices.read', 'accounting.read', 'payments.read'] },
  { key: 'metricCurrency', zone: 'hero', span: 3, source: 'outstanding', permission: ['invoices.read', 'accounting.read', 'payments.read'] },
  { key: 'trend', zone: 'charts', span: 8, source: 'revenue', permission: ['invoices.read', 'accounting.read', 'payments.read'] },
  { key: 'cashFlow', zone: 'charts', span: 4, permission: ['invoices.read', 'accounting.read', 'payments.read'] },
  { key: 'forecast', zone: 'charts', span: 12, source: 'forecast', permission: ['invoices.read', 'accounting.read', 'payments.read'] },
  { key: 'aiInsights', zone: 'insights', span: 12, aiRequired: true, permission: ['ai.read'] },
  { key: 'activity', zone: 'bottom', span: 12, permission: ['audit.read'] },
];

const approvals: WidgetDefinition[] = [
  { key: 'approvals', zone: 'side', span: 4, permission: ['invoices.approve', 'purchase.approve', 'sales.approve'] },
];

const finance: RoleProfile = {
  id: 'finance',
  label: 'Finance',
  priority: 40,
  headline: 'Financial position',
  subtitle: 'Revenue, cash and outstanding balances.',
  icon: Landmark,
  widgets: [...baseFinanceWidgets, ...approvals],
  modules: ['accounting', 'invoices', 'payments', 'billing', 'reports', 'payroll', 'purchases'],
  quickActions: [
    { id: 'create-invoice', label: 'Create Invoice', icon: Landmark, permission: 'invoices.create', command: 'invoice.create', shortcut: 'I' },
    { id: 'run-report', label: 'Run Report', icon: Wallet, permission: 'reports.read', command: 'reports.generate', shortcut: 'R' },
    { id: 'record-payment', label: 'Record Payment', icon: Landmark, permission: 'payments.create', command: 'payment.create' },
  ],
};

export const ROLE_PROFILES: Record<RoleKey, RoleProfile> = {
  'super-admin': {
    id: 'super-admin',
    label: 'Platform Super Admin',
    priority: 10,
    headline: 'Platform command centre',
    subtitle: 'Organisations, plans and platform health.',
    icon: Crown,
    widgets: [
      { key: 'metric', zone: 'hero', span: 3, source: 'organizations' },
      { key: 'metric', zone: 'hero', span: 3, source: 'activeOrgs' },
      { key: 'metricCurrency', zone: 'hero', span: 3, source: 'platformRevenue' },
      { key: 'metric', zone: 'hero', span: 3, source: 'users' },
      { key: 'trend', zone: 'charts', span: 12, source: 'platformGrowth' },
      { key: 'aiInsights', zone: 'insights', span: 12, aiRequired: true, permission: ['ai.read'] },
      { key: 'activity', zone: 'bottom', span: 12, permission: ['audit.read'] },
    ],
    modules: ['dashboard', 'users', 'roles', 'billing', 'audit', 'accounting', 'ai', 'reports'],
    quickActions: [
      { id: 'add-org', label: 'Add Organization', icon: Building, permission: 'organization.manage', command: 'org.create' },
      { id: 'invite-admin', label: 'Invite Admin', icon: Users2, permission: 'users.create', command: 'user.invite' },
    ],
  },
  owner: {
    id: 'owner',
    label: 'Organization Owner',
    priority: 20,
    headline: 'Executive overview',
    subtitle: 'Everything your business needs today.',
    icon: Crown,
    widgets: [
      { key: 'metricCurrency', zone: 'hero', span: 3, source: 'monthlyRevenue', permission: ['invoices.read', 'accounting.read', 'payments.read'] },
      { key: 'metric', zone: 'hero', span: 3, source: 'openOrders' },
      { key: 'metric', zone: 'hero', span: 3, source: 'lowStock', permission: ['inventory.read'] },
      { key: 'metric', zone: 'hero', span: 3, source: 'pendingApprovals' },
      { key: 'trend', zone: 'charts', span: 8, source: 'revenue', permission: ['invoices.read', 'accounting.read', 'payments.read'] },
      { key: 'donut', zone: 'charts', span: 4, source: 'customers', permission: ['customers.read'] },
      { key: 'approvals', zone: 'side', span: 4, permission: ['invoices.approve', 'purchase.approve', 'sales.approve'] },
      { key: 'activity', zone: 'side', span: 4, permission: ['audit.read'] },
      { key: 'aiInsights', zone: 'insights', span: 12, aiRequired: true, permission: ['ai.read'] },
      { key: 'quickActions', zone: 'bottom', span: 5 },
    ],
    modules: ['dashboard', 'users', 'roles', 'billing', 'audit', 'accounting', 'customers', 'suppliers', 'products', 'inventory', 'sales', 'purchases', 'payments', 'ai', 'reports'],
    quickActions: [
      { id: 'create-invoice', label: 'Create Invoice', icon: Landmark, permission: 'invoices.create', command: 'invoice.create', shortcut: 'I' },
      { id: 'add-user', label: 'Add User', icon: Users2, permission: 'users.create', command: 'user.invite', shortcut: 'U' },
      { id: 'create-purchase', label: 'Create Purchase', icon: Briefcase, permission: 'purchase.create', command: 'purchase.create', shortcut: 'P' },
      { id: 'run-report', label: 'Run Report', icon: Wallet, permission: 'reports.read', command: 'reports.generate', shortcut: 'R' },
    ],
  },
  ceo: {
    id: 'ceo',
    label: 'CEO / Executive',
    priority: 25,
    headline: 'Executive overview',
    subtitle: 'Strategy, growth and company health.',
    icon: Briefcase,
    widgets: [
      { key: 'metricCurrency', zone: 'hero', span: 4, source: 'monthlyRevenue', permission: ['invoices.read', 'accounting.read', 'payments.read'] },
      { key: 'metricCurrency', zone: 'hero', span: 4, source: 'netProfit', permission: ['invoices.read', 'accounting.read', 'payments.read'] },
      { key: 'metric', zone: 'hero', span: 4, source: 'growth' },
      { key: 'trend', zone: 'charts', span: 8, source: 'revenue', permission: ['invoices.read', 'accounting.read', 'payments.read'] },
      { key: 'healthScore', zone: 'charts', span: 4 },
      { key: 'aiInsights', zone: 'insights', span: 12, aiRequired: true, permission: ['ai.read'] },
      { key: 'activity', zone: 'bottom', span: 12, permission: ['audit.read'] },
    ],
    modules: ['dashboard', 'customers', 'accounting', 'sales', 'reports', 'ai', 'billing', 'employees'],
    quickActions: [
      { id: 'run-report', label: 'Run Report', icon: Wallet, permission: 'reports.read', command: 'reports.generate', shortcut: 'R' },
      { id: 'ask-ai', label: 'Ask AI', icon: Briefcase, permission: 'ai.read', command: 'ai.ask', shortcut: 'A' },
    ],
  },
  coo: {
    id: 'coo',
    label: 'COO / Operations',
    priority: 30,
    headline: 'Operations control room',
    subtitle: 'Delivery, capacity and day-to-day execution.',
    icon: Building,
    widgets: [
      { key: 'metric', zone: 'hero', span: 3, source: 'openOrders' },
      { key: 'metric', zone: 'hero', span: 3, source: 'pendingDeliveries' },
      { key: 'metric', zone: 'hero', span: 3, source: 'lowStock', permission: ['inventory.read'] },
      { key: 'metric', zone: 'hero', span: 3, source: 'employees' },
      { key: 'trend', zone: 'charts', span: 8, source: 'orders', permission: ['sales.read', 'purchase.read'] },
      { key: 'donut', zone: 'charts', span: 4, source: 'departmentLoad' },
      { key: 'list', zone: 'side', span: 8, source: 'ordersQueue', permission: ['sales.read'] },
      { key: 'approvals', zone: 'side', span: 4, permission: ['invoices.approve', 'purchase.approve', 'sales.approve'] },
      { key: 'quickActions', zone: 'bottom', span: 12 },
    ],
    modules: ['dashboard', 'customers', 'suppliers', 'products', 'inventory', 'sales', 'purchases', 'employees', 'ai'],
    quickActions: [
      { id: 'create-purchase', label: 'Create Purchase', icon: Briefcase, permission: 'purchase.create', command: 'purchase.create', shortcut: 'P' },
      { id: 'adjust-stock', label: 'Adjust Stock', icon: Boxes, permission: 'inventory.adjust', command: 'inventory.adjust' },
    ],
  },
  manager: {
    id: 'manager',
    label: 'Manager',
    priority: 50,
    headline: 'Team overview',
    subtitle: 'Your team, work and approvals.',
    icon: Target,
    widgets: [
      { key: 'metric', zone: 'hero', span: 3, source: 'teamSize' },
      { key: 'metric', zone: 'hero', span: 3, source: 'pendingApprovals' },
      { key: 'metric', zone: 'hero', span: 3, source: 'openOrders' },
      { key: 'metricCurrency', zone: 'hero', span: 3, source: 'teamCost' },
      { key: 'approvals', zone: 'side', span: 4, permission: ['invoices.approve', 'purchase.approve', 'sales.approve'] },
      { key: 'calendar', zone: 'side', span: 4 },
      { key: 'aiInsights', zone: 'insights', span: 12, aiRequired: true, permission: ['ai.read'] },
      { key: 'activity', zone: 'bottom', span: 12, permission: ['audit.read'] },
    ],
    modules: ['dashboard', 'customers', 'products', 'inventory', 'sales', 'purchases', 'employees', 'ai'],
    quickActions: [
      { id: 'approve-request', label: 'Approve Request', icon: Target, permission: 'invoices.approve', command: 'approvals.list' },
      { id: 'create-order', label: 'Create Order', icon: Briefcase, permission: 'sales.create', command: 'order.create' },
    ],
  },
  finance,
  hr: {
    id: 'hr',
    label: 'Human Resources',
    priority: 60,
    headline: 'People operations',
    subtitle: 'Staff, payroll and leave.',
    icon: Users2,
    widgets: [
      { key: 'metric', zone: 'hero', span: 3, source: 'totalEmployees' },
      { key: 'metric', zone: 'hero', span: 3, source: 'pendingLeaves', permission: ['employees.read'] },
      { key: 'metricCurrency', zone: 'hero', span: 3, source: 'monthlyPayroll', permission: ['payroll.read'] },
      { key: 'metric', zone: 'hero', span: 3, source: 'openRoles' },
      { key: 'calendar', zone: 'charts', span: 4 },
      { key: 'donut', zone: 'charts', span: 4, source: 'departmentLoad', permission: ['employees.read'] },
      { key: 'list', zone: 'charts', span: 4, source: 'leaveRequests', permission: ['employees.read'] },
      { key: 'approvals', zone: 'side', span: 4, permission: ['employees.approve'] },
      { key: 'aiInsights', zone: 'insights', span: 12, aiRequired: true, permission: ['ai.read'] },
    ],
    modules: ['dashboard', 'employees', 'payroll', 'users', 'roles', 'ai'],
    quickActions: [
      { id: 'add-employee', label: 'Add Employee', icon: Users2, permission: 'employees.create', command: 'employee.create', shortcut: 'E' },
      { id: 'approve-leave', label: 'Approve Leave', icon: Users2, permission: 'employees.approve', command: 'leave.approve' },
    ],
  },
  sales: {
    id: 'sales',
    label: 'Sales',
    priority: 70,
    headline: 'Sales performance',
    subtitle: 'Pipeline, orders and targets.',
    icon: Target,
    widgets: [
      { key: 'metricCurrency', zone: 'hero', span: 3, source: 'salesToday', permission: ['sales.read'] },
      { key: 'metric', zone: 'hero', span: 3, source: 'openOrders' },
      { key: 'metric', zone: 'hero', span: 3, source: 'pipeline' },
      { key: 'metric', zone: 'hero', span: 3, source: 'targetProgress' },
      { key: 'trend', zone: 'charts', span: 8, source: 'sales', permission: ['sales.read'] },
      { key: 'donut', zone: 'charts', span: 4, source: 'customers', permission: ['customers.read'] },
      { key: 'forecast', zone: 'charts', span: 12, source: 'salesForecast', permission: ['sales.read'] },
      { key: 'quickActions', zone: 'bottom', span: 12 },
    ],
    modules: ['dashboard', 'customers', 'crm', 'sales', 'invoices', 'products', 'ai'],
    quickActions: [
      { id: 'create-invoice', label: 'Create Invoice', icon: Landmark, permission: 'invoices.create', command: 'invoice.create', shortcut: 'I' },
      { id: 'add-customer', label: 'Add Customer', icon: Users2, permission: 'customers.create', command: 'customer.create' },
    ],
  },
  inventory: {
    id: 'inventory',
    label: 'Inventory',
    priority: 80,
    headline: 'Stock & warehouse',
    subtitle: 'Stock levels, movements and reorders.',
    icon: Boxes,
    widgets: [
      { key: 'metric', zone: 'hero', span: 3, source: 'productsInStock' },
      { key: 'metricCurrency', zone: 'hero', span: 3, source: 'stockValue' },
      { key: 'metric', zone: 'hero', span: 3, source: 'lowStock', permission: ['inventory.read'] },
      { key: 'metric', zone: 'hero', span: 3, source: 'outOfStock' },
      { key: 'list', zone: 'charts', span: 6, source: 'lowStock', permission: ['inventory.read'] },
      { key: 'trend', zone: 'charts', span: 6, source: 'stockMovement', permission: ['inventory.read'] },
      { key: 'quickActions', zone: 'bottom', span: 12 },
    ],
    modules: ['dashboard', 'products', 'inventory', 'suppliers', 'purchases', 'sales'],
    quickActions: [
      { id: 'adjust-stock', label: 'Adjust Stock', icon: Boxes, permission: 'inventory.adjust', command: 'inventory.adjust' },
      { id: 'create-purchase', label: 'Create Purchase', icon: Briefcase, permission: 'purchase.create', command: 'purchase.create' },
    ],
  },
  support: {
    id: 'support',
    label: 'Support',
    priority: 90,
    headline: 'Support queue',
    subtitle: 'Requests, customers and follow-ups.',
    icon: Headset,
    widgets: [
      { key: 'metric', zone: 'hero', span: 3, source: 'openTickets' },
      { key: 'metric', zone: 'hero', span: 3, source: 'resolvedToday' },
      { key: 'metric', zone: 'hero', span: 3, source: 'pendingCustomers' },
      { key: 'metric', zone: 'hero', span: 3, source: 'sla' },
      { key: 'list', zone: 'charts', span: 12, source: 'supportQueue' },
      { key: 'quickActions', zone: 'bottom', span: 12 },
    ],
    modules: ['dashboard', 'customers', 'crm', 'products'],
    quickActions: [
      { id: 'add-customer', label: 'Add Customer', icon: Users2, permission: 'customers.create', command: 'customer.create' },
    ],
  },
  employee: {
    id: 'employee',
    label: 'Employee',
    priority: 100,
    headline: 'My work day',
    subtitle: 'Tasks, time and personal activity.',
    icon: User,
    widgets: [
      { key: 'metric', zone: 'hero', span: 3, source: 'myTasks' },
      { key: 'metric', zone: 'hero', span: 3, source: 'hoursToday' },
      { key: 'metric', zone: 'hero', span: 3, source: 'pendingLeaves', permission: ['employees.read'] },
      { key: 'metric', zone: 'hero', span: 3, source: 'upcomingEvents' },
      { key: 'calendar', zone: 'charts', span: 12 },
      { key: 'quickActions', zone: 'bottom', span: 12 },
    ],
    modules: ['dashboard', 'customers', 'sales', 'employees'],
    quickActions: [
      { id: 'request-leave', label: 'Request Leave', icon: Users2, permission: 'employees.read', command: 'leave.request' },
    ],
  },
  guest: {
    id: 'guest',
    label: 'Guest / Viewer',
    priority: 110,
    headline: 'Read-only overview',
    subtitle: 'A glance at the business, no changes.',
    icon: Eye,
    widgets: [
      { key: 'metric', zone: 'hero', span: 4, source: 'monthlyRevenue', permission: ['invoices.read', 'accounting.read', 'payments.read'] },
      { key: 'metric', zone: 'hero', span: 4, source: 'openOrders' },
      { key: 'metric', zone: 'hero', span: 4, source: 'employees' },
      { key: 'trend', zone: 'charts', span: 12, source: 'revenue', permission: ['invoices.read', 'accounting.read', 'payments.read'] },
    ],
    modules: ['dashboard', 'customers', 'sales'],
    quickActions: [],
  },
};

export const ROLE_BY_KEY: Record<RoleKey, RoleProfile> = ROLE_PROFILES;

export function resolveRoleKey(
  role: string | undefined,
  permissions: string[],
): RoleKey {
  const has = (...required: string[]) => required.some((p) => permissions.includes(p));
  const roleNorm = role?.toUpperCase();

  if (roleNorm === 'SUPER_ADMIN') return 'super-admin';

  if (has('organization.manage') || roleNorm === 'ADMIN') {
    if (has('payroll.read') && has('accounting.read') && has('billing.read')) return 'owner';
    if (has('payroll.read') && has('accounting.read')) return 'finance';
    if (has('employees.read') && has('payroll.read') && !has('accounting.read')) return 'hr';
    if (has('inventory.read') && has('purchase.read') && has('sales.read') && has('employees.read')) return 'coo';
    return 'owner';
  }

  if (roleNorm === 'MANAGER') return 'manager';
  if (has('payroll.read') && has('accounting.read')) return 'finance';
  if (has('payroll.read')) return 'hr';
  if (has('sales.read') && has('invoices.read')) return 'sales';
  if (has('inventory.read') && has('purchase.read')) return 'inventory';
  if (has('customers.read') && has('crm.read')) return 'support';
  if (roleNorm === 'VIEWER') return 'guest';
  return 'employee';
}
