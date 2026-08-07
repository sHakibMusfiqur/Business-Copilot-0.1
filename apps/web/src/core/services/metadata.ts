import type { ReservedService, ServiceCategory } from './types';

/** Canonical service categories, in display order. */
export const SERVICE_CATEGORIES: readonly ServiceCategory[] = [
  'core',
  'platform',
  'infrastructure',
  'application',
  'shared',
  'plugin',
  'ai',
  'integration',
];

export const RESERVED_SERVICES: readonly ReservedService[] = [
  { id: 'ai', name: 'AI Service', category: 'ai' },
  { id: 'workflow', name: 'Workflow Service', category: 'core' },
  { id: 'notifications', name: 'Notification Service', category: 'shared' },
  { id: 'storage', name: 'Storage Service', category: 'infrastructure' },
  { id: 'search', name: 'Search Service', category: 'infrastructure' },
  { id: 'integrations', name: 'Integration Service', category: 'integration' },
  { id: 'audit', name: 'Audit Service', category: 'platform' },
  { id: 'webhooks', name: 'Webhook Service', category: 'integration' },
  { id: 'automation', name: 'Automation Service', category: 'core' },
  { id: 'rules', name: 'Rule Engine', category: 'core' },
  { id: 'feature-flags', name: 'Feature Flag Service', category: 'platform' },
  { id: 'plugins', name: 'Plugin Manager', category: 'plugin' },
  { id: 'scheduler', name: 'Scheduler Service', category: 'infrastructure' },
  { id: 'secrets', name: 'Secrets Service', category: 'infrastructure' },
  { id: 'cache', name: 'Cache Service', category: 'infrastructure' },
  { id: 'metrics', name: 'Metrics Service', category: 'infrastructure' },
  { id: 'telemetry', name: 'Telemetry Service', category: 'infrastructure' },
];

/** Ids of every reserved service slot. */
export const RESERVED_SERVICE_IDS: readonly string[] = RESERVED_SERVICES.map((service) => service.id);