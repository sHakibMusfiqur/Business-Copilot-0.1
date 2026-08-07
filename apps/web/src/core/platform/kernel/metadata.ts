import packageJson from '../../../../package.json';

import type { BuildInfo, PlatformMetadata, ReservedEngine } from './types';

/** Immutable platform metadata. Version is sourced from the web package.json. */
export const PLATFORM_METADATA: PlatformMetadata = {
  name: 'Business Copilot',
  codeName: 'Business OS',
  shortName: 'BC',
  vendor: 'Business Copilot',
  version: packageJson.version,
};

/** Build information resolved once when the kernel module loads. */
export const BUILD_INFO: BuildInfo = {
  id: process.env.NEXT_PUBLIC_BUILD_ID ?? 'local',
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  builtAt: new Date().toISOString(),
};

export const RESERVED_ENGINES: readonly ReservedEngine[] = [
  { id: 'plugins', name: 'Plugin Engine', kind: 'plugin' },
  { id: 'workflow', name: 'Workflow Engine', kind: 'workflow' },
  { id: 'automation', name: 'Automation Engine', kind: 'automation' },
  { id: 'ai-gateway', name: 'AI Gateway', kind: 'ai' },
  { id: 'notifications', name: 'Notification Engine', kind: 'notification' },
  { id: 'search', name: 'Search Engine', kind: 'search' },
  { id: 'storage', name: 'Storage Engine', kind: 'storage' },
  { id: 'feature-flags', name: 'Feature Flag Engine', kind: 'feature-flags' },
  { id: 'rules', name: 'Rule Engine', kind: 'rules' },
  { id: 'integrations', name: 'Integration Engine', kind: 'integration' },
  { id: 'webhooks', name: 'Webhook Engine', kind: 'webhook' },
  { id: 'event-bus', name: 'Event Bus', kind: 'event-bus' },
  { id: 'analytics', name: 'Analytics Engine', kind: 'analytics' },
  { id: 'sdk', name: 'Developer SDK', kind: 'sdk' },
];

/** Ids of every reserved engine slot. */
export const RESERVED_ENGINE_IDS: readonly string[] = RESERVED_ENGINES.map((engine) => engine.id);
