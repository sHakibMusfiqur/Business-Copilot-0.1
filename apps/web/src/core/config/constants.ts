import type { ConfigScope, ConfigValueType } from './types';

/** The valid schema type literals for config values. */
export const CONFIG_VALUE_TYPES: readonly ConfigValueType[] = [
  'string',
  'number',
  'boolean',
];

/** Canonical resolution ordering, from lowest to highest precedence. */
export const CONFIG_SCOPE_ORDER: readonly ConfigScope[] = [
  'platform',
  'environment',
  'tenant',
  'organization',
  'workspace',
  'module',
  'runtime',
  'feature',
];

/** The hierarchy level each scope maps onto, for precedence comparisons. */
export const CONFIG_SCOPE_RANK: Record<ConfigScope, number> = {
  platform: 0,
  environment: 1,
  tenant: 2,
  organization: 3,
  workspace: 4,
  module: 5,
  runtime: 6,
  feature: 7,
};