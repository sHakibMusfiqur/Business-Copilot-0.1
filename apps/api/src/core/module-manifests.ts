import type { ModuleManifest } from '@bc/core';


export const BUILTIN_MODULE_MANIFESTS: readonly ModuleManifest[] = [
  {
    id: 'crm',
    name: 'CRM & Leads',
    description: 'Lead and activity management.',
    category: 'Relations',
    route: '/crm',
    permissions: ['crm.read'],
    capabilities: ['crm'],
    status: 'stable',
  },
  {
    id: 'billing',
    name: 'Billing & Plan',
    description: 'Subscriptions and payments.',
    category: 'Administration',
    route: '/billing',
    permissions: ['billing.read'],
    capabilities: ['administration', 'platform'],
    status: 'stable',
  },
];