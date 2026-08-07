import { CAPABILITY_DEFINITIONS } from '../../capabilities/capabilities';
import { ALL_FEATURES } from '../../features/catalog';
import { DEFAULT_CONFIG } from '../../config/metadata';
import { ALL_TOKENS } from '../../design/engine';
import { DEFAULT_ERROR_CATALOG } from '../../errors/catalog';
import { MODULE_MANIFESTS } from '../../modules/definitions';
import { RESERVED_SERVICES } from '../../services/metadata';
import { LOG_CATEGORIES, LOG_LEVELS } from '../../logger';
import type { IdentityInput } from '../types';

/** Stable version string shared by catalog-derived identities. */
const V = '1.0.0';

/** Core service ids already registered by the bootstrap. */
const CORE_SERVICE_IDS: readonly string[] = [
  'environment',
  'modules',
  'capabilities',
  'permissions',
  'entitlements',
  'navigation',
  'layout',
  'theme',
  'manifest',
  'workspace',
  'config',
  'design',
  'features',
  'errors',
  'logger',
];

/** Core engine ids registered by the Platform Kernel bootstrap. */
const CORE_ENGINE_IDS: readonly string[] = [
  'platform',
  'modules',
  'capabilities',
  'permissions',
  'entitlements',
  'navigation',
  'layout',
  'theme',
  'manifest',
  'workspace',
];

/** Map an identity into an IdentityInput with its kind + namespace. */
function id(
  kind: IdentityInput['kind'],
  ref: string,
  name: string,
  extra?: Partial<Omit<IdentityInput, 'kind' | 'ref' | 'name'>> & { id?: string },
): IdentityInput {
  return {
    kind,
    ref,
    name,
    id: extra?.id ?? ref,
    ...(extra ?? {}),
    version: extra?.version ?? V,
  } as IdentityInput;
}

/**
 * Identity catalog — derives canonical identities from the existing engines,
 * so the Identity Engine is the lookup layer without duplicating definitions.
 */
const CATALOG: readonly IdentityInput[] = [
  // ── Engines ──────────────────────────────────────────────────────────────
  ...CORE_ENGINE_IDS.map((engineId) => id('engine', engineId, engineId)),

  // ── Services ─────────────────────────────────────────────────────────────
  ...CORE_SERVICE_IDS.map((serviceId) => id('service', serviceId, serviceId)),
  ...RESERVED_SERVICES.map((service) => id('service', service.id, service.name, { experimental: true })),

  // ── Modules ───────────────────────────────────────────────────────────────
  ...MODULE_MANIFESTS.map((manifest) =>
    id('module', manifest.id, manifest.name, { description: manifest.description }),
  ),

  // ── Features ─────────────────────────────────────────────────────────────
  ...ALL_FEATURES.map((feature) =>
    id('feature', feature.id, feature.name, {
      description: feature.description,
      experimental: feature.experimental,
      internal: feature.internal,
      deprecated: feature.deprecated,
    }),
  ),

  // ── Capabilities ─────────────────────────────────────────────────────────
  ...Object.keys(CAPABILITY_DEFINITIONS).map((capabilityKey) =>
    id('capability', capabilityKey, capabilityKey, {
      description: CAPABILITY_DEFINITIONS[capabilityKey as keyof typeof CAPABILITY_DEFINITIONS].description,
    }),
  ),

  // ── Configuration keys ────────────────────────────────────────────────────
  ...DEFAULT_CONFIG.map((config) =>
    id('config', config.id, config.id, { description: config.description }),
  ),

  // ── Design tokens ─────────────────────────────────────────────────────────
  ...ALL_TOKENS.map((token) =>
    id('token', token.id, token.name, {
      description: token.description,
      experimental: token.experimental,
      internal: token.internal,
      deprecated: token.deprecated,
    }),
  ),

  // ── Logger categories / levels ────────────────────────────────────────────
  ...LOG_CATEGORIES.map((category) => id('logger', category, category, { id: `logger.${category}` })),
  ...LOG_LEVELS.map((level) => id('logger', `level.${level}`, `level.${level}`, { id: `loglevel.${level}`, experimental: true })),

  // ── Errors ───────────────────────────────────────────────────────────────
  ...DEFAULT_ERROR_CATALOG.map((error) =>
    id('error', error.code, error.name, { description: error.description }),
  ),

  // ── Reserved future domains (cataloged, not implemented) ──────────────────
  id('plugin', 'registry', 'Plugin Registry', { experimental: true }),
  id('workflow', 'engine', 'WorkflowEngine', { experimental: true }),
  id('automation', 'engine', 'AutomationEngine', { experimental: true }),
  id('notification', 'engine', 'NotificationEngine', { experimental: true }),
  id('integration', 'engine', 'IntegrationEngine', { experimental: true }),
  id('ai', 'engine', 'AIEngine', { experimental: true }),
  id('scheduler', 'engine', 'SchedulerEngine', { experimental: true }),
  id('storage', 'engine', 'StorageEngine', { experimental: true }),
  id('search', 'engine', 'SearchEngine', { experimental: true }),
  id('dashboard', 'overview', 'dashboard', { experimental: true }),
  id('route', 'dashboard', '/dashboard', { experimental: true }),
  id('command', 'quick-add', 'QuickAdd', { experimental: true }),
  id('widget', 'kpi-card', 'KPICard', { experimental: true }),
];

export const IDENTITY_CATALOG: readonly IdentityInput[] = Object.freeze(CATALOG);