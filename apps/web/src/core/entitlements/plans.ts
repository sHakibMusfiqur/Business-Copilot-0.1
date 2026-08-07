import type { PlanEntitlements, UsageLimits } from './types';

const UNLIMITED: UsageLimits = {
  users: Number.MAX_SAFE_INTEGER,
  customers: Number.MAX_SAFE_INTEGER,
  products: Number.MAX_SAFE_INTEGER,
  storageGb: Number.MAX_SAFE_INTEGER,
  aiCredits: Number.MAX_SAFE_INTEGER,
};

const ALL_MODULES = Object.freeze({
  dashboard: true,
  customers: true,
  suppliers: true,
  crm: true,
  products: true,
  inventory: true,
  sales: true,
  purchases: true,
  accounting: true,
  accounts: true,
  journal: true,
  ledger: true,
  trial: true,
  receivables: true,
  payables: true,
  payments: true,
  employees: true,
  payroll: true,
  roles: true,
  users: true,
  audit: true,
  billing: true,
  reports: true,
  ai: true,
});


export const PLAN_ENTITLEMENTS: Record<string, PlanEntitlements> = {
  starter: {
    key: 'starter',
    name: 'Starter',
    features: { reports: false, apiAccess: false, customBranding: false, prioritySupport: false },
    modules: {
      dashboard: true,
      customers: true,
      suppliers: true,
      products: true,
      inventory: true,
      sales: true,
      purchases: true,
      accounting: true,
      payments: true,
      reports: false,
      ai: false,
      billing: true,
    },
    limits: {
      users: 5,
      customers: 500,
      products: 500,
      storageGb: 5,
      aiCredits: 0,
    },
    trialDays: 14,
  },
  growth: {
    key: 'growth',
    name: 'Growth',
    features: { reports: true, apiAccess: true, customBranding: false, prioritySupport: false },
    modules: {
      ...ALL_MODULES,
      payroll: true,
      employees: true,
      audit: true,
      ai: true,
    },
    limits: {
      users: 25,
      customers: 5000,
      products: 5000,
      storageGb: 50,
      aiCredits: 1000,
    },
    trialDays: 14,
  },
  enterprise: {
    key: 'enterprise',
    name: 'Enterprise',
    features: { reports: true, apiAccess: true, customBranding: true, prioritySupport: true },
    modules: ALL_MODULES,
    limits: UNLIMITED,
    trialDays: 0,
  },
};


export const FULL_ACCESS: PlanEntitlements = {
  key: 'default',
  name: 'Full access',
  features: { reports: true, apiAccess: true, customBranding: true, prioritySupport: true },
  modules: ALL_MODULES,
  limits: UNLIMITED,
  trialDays: 0,
};
