import type { PolicyDef } from './types';

export const POLICIES: Record<string, PolicyDef> = {
  'finance.read': {
    id: 'finance.read',
    label: 'Finance — read',
    grants: ['invoices.read', 'accounting.read', 'payments.read'],
  },
  'operations.read': {
    id: 'operations.read',
    label: 'Operations — read',
    grants: ['inventory.read', 'purchase.read', 'sales.read'],
  },
  'people.read': {
    id: 'people.read',
    label: 'People — read',
    grants: ['employees.read', 'payroll.read'],
  },
  'administration.full': {
    id: 'administration.full',
    label: 'Administration — full',
    grants: ['organization.manage', 'users.read', 'users.create', 'audit.read', 'billing.read'],
  },
};

export const POLICY_IDS: readonly string[] = Object.keys(POLICIES);
