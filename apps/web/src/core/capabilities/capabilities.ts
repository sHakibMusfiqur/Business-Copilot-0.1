import {
  BarChart3,
  Bot,
  Boxes,
  Calculator,
  ChartNoAxesCombined,
  CircleUserRound,
  Contact,
  Factory,
  Landmark,
  Shield,
  ShoppingCart,
  Wallet,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

import type { CapabilityKey } from '@/core/types';

import type { CapabilityDef } from './types';


export const CAPABILITY_DEFINITIONS: Record<CapabilityKey, CapabilityDef> = {
  dashboard: {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Executive overview and metric widgets.',
    icon: BarChart3,
  },
  analytics: {
    id: 'analytics',
    label: 'Analytics',
    description: 'Trends, distributions and business analytics.',
    icon: ChartNoAxesCombined,
  },
  reports: {
    id: 'reports',
    label: 'Reports',
    description: 'Report generation and export.',
    icon: BarChart3,
  },
  crm: {
    id: 'crm',
    label: 'CRM',
    description: 'Customers, leads and relationship management.',
    icon: Contact,
  },
  accounting: {
    id: 'accounting',
    label: 'Accounting',
    description: 'Ledger, journal and financial statements.',
    icon: Calculator,
  },
  finance: {
    id: 'finance',
    label: 'Finance',
    description: 'Payments, receivables and payables.',
    icon: Landmark,
  },
  inventory: {
    id: 'inventory',
    label: 'Inventory',
    description: 'Products, stock and warehouses.',
    icon: Boxes,
  },
  procurement: {
    id: 'procurement',
    label: 'Procurement',
    description: 'Suppliers and purchase orders.',
    icon: ShoppingCart,
  },
  manufacturing: {
    id: 'manufacturing',
    label: 'Manufacturing',
    description: 'Production, work orders and quality.',
    icon: Factory,
  },
  hr: {
    id: 'hr',
    label: 'Human Resources',
    description: 'Employees and people operations.',
    icon: CircleUserRound,
  },
  payroll: {
    id: 'payroll',
    label: 'Payroll',
    description: 'Salary and payroll runs.',
    icon: Wallet,
  },
  pos: {
    id: 'pos',
    label: 'Point of Sale',
    description: 'Sales orders and checkout.',
    icon: ShoppingCart,
  },
  ecommerce: {
    id: 'ecommerce',
    label: 'E-commerce',
    description: 'Orders and commerce channels.',
    icon: ShoppingCart,
  },
  ai: {
    id: 'ai',
    label: 'AI Copilot',
    description: 'AI insights and assistive actions.',
    icon: Bot,
  },
  workflow: {
    id: 'workflow',
    label: 'Workflow',
    description: 'Automated business workflows.',
    icon: Workflow,
  },
  administration: {
    id: 'administration',
    label: 'Administration',
    description: 'Users, roles, audit and organization settings.',
    icon: Shield,
  },
  platform: {
    id: 'platform',
    label: 'Platform',
    description: 'Platform-level operations and billing.',
    icon: Landmark,
  },
};

export const CAPABILITY_ICONS: Record<CapabilityKey, LucideIcon> = {
  dashboard: BarChart3,
  analytics: ChartNoAxesCombined,
  reports: BarChart3,
  crm: Contact,
  accounting: Calculator,
  finance: Landmark,
  inventory: Boxes,
  procurement: ShoppingCart,
  manufacturing: Factory,
  hr: CircleUserRound,
  payroll: Wallet,
  pos: ShoppingCart,
  ecommerce: ShoppingCart,
  ai: Bot,
  workflow: Workflow,
  administration: Shield,
  platform: Landmark,
};
