import type { ConfigDefinition, ConfigScope } from './types';

/** Built-in configuration catalog — the platform's base configuration schema. */
export interface DefaultConfig {
  id: string;
  scope: ConfigScope;
  category: string;
  version: string;
  description?: string;
  default?: ConfigDefinition['default'];
  type?: ConfigDefinition['type'];
  validator?: ConfigDefinition['validator'];
  compute?: ConfigDefinition['compute'];
  readonly?: boolean;
  runtime?: boolean;
  internal?: boolean;
  experimental?: boolean;
  deprecated?: boolean;
  owner?: string;
  tags?: readonly string[];
}

/** Predefined configuration entries with sensible platform defaults. */
export const DEFAULT_CONFIG: DefaultConfig[] = [
  {
    id: 'platform.name',
    scope: 'platform',
    category: 'platform',
    version: '1.0.0',
    description: 'Platform display name.',
    default: 'Business Copilot',
    type: 'string',
    readonly: true,
    owner: 'platform',
    tags: ['platform'],
  },
  {
    id: 'platform.version',
    scope: 'platform',
    category: 'platform',
    version: '1.0.0',
    description: 'Platform version.',
    default: '1.0.0',
    type: 'string',
    readonly: true,
    owner: 'platform',
    tags: ['platform'],
  },
  {
    id: 'environment.mode',
    scope: 'environment',
    category: 'platform',
    version: '1.0.0',
    description: 'Environment mode: development or production.',
    default: 'development',
    type: 'string',
    internal: true,
    owner: 'platform',
    tags: ['environment'],
  },
  {
    id: 'platform.mode',
    scope: 'platform',
    category: 'platform',
    version: '1.0.0',
    description: 'Effective runtime mode, computed from the environment.',
    default: 'development',
    type: 'string',
    readonly: true,
    owner: 'platform',
    tags: ['platform', 'environment'],
    compute: (values) => (values['environment.mode'] as string) ?? 'development',
  },
  {
    id: 'workspace.aiEnabled',
    scope: 'workspace',
    category: 'feature',
    version: '1.0.0',
    description: 'Toggles AI-assisted features for the workspace.',
    default: true,
    type: 'boolean',
    runtime: true,
    owner: 'workspace',
    tags: ['feature', 'ai'],
  },
  {
    id: 'workspace.defaultCurrency',
    scope: 'workspace',
    category: 'workspace',
    version: '1.0.0',
    description: 'Default currency for financial widgets.',
    default: 'USD',
    type: 'string',
    owner: 'workspace',
    tags: ['currency'],
  },
  {
    id: 'billing.seatLimit',
    scope: 'organization',
    category: 'billing',
    version: '1.0.0',
    description: 'Maximum number of active seats.',
    default: 5,
    type: 'number',
    owner: 'organization',
    tags: ['billing', 'limits'],
  },
  {
    id: 'reports.exportEnabled',
    scope: 'module',
    category: 'reports',
    version: '1.0.0',
    description: 'Whether report export is enabled.',
    default: true,
    type: 'boolean',
    owner: 'reports',
    tags: ['reports', 'feature'],
  },
  {
    id: 'design.primaryColor',
    scope: 'workspace',
    category: 'design',
    version: '1.0.0',
    description: 'Primary brand color used by the design token engine.',
    default: 'hsl(var(--primary))',
    type: 'string',
    owner: 'design-system',
    tags: ['design', 'brand'],
  },
  {
    id: 'logging.level',
    scope: 'platform',
    category: 'logging',
    version: '1.0.0',
    description: 'Minimum log level emitted by the logger engine.',
    default: 'info',
    type: 'string',
    validator: (value) =>
      typeof value === 'string' &&
      ['trace', 'debug', 'info', 'notice', 'warning', 'error', 'critical', 'fatal'].includes(value),
    owner: 'platform',
    tags: ['logging'],
  },
];

export const DEFAULT_CONFIG_BY_ID: Record<string, DefaultConfig> = Object.fromEntries(
  DEFAULT_CONFIG.map((config) => [config.id, config]),
);