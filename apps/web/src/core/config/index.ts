/** Enterprise Configuration Engine — public surface. */
export { ConfigEngine } from './engine';
export { DEFAULT_CONFIG, DEFAULT_CONFIG_BY_ID } from './metadata';
export { CONFIG_SCOPE_ORDER, CONFIG_SCOPE_RANK, CONFIG_VALUE_TYPES } from './constants';
export { ConfigError, ConfigNotFoundError, ConfigValidationError, ConfigComputationError, ConfigReadonlyError } from './errors';
export type { ConfigScope, ConfigValue, ConfigValueType, ConfigSource, ConfigMetadata, ConfigDefinition, ConfigEntry, ConfigValues, ConfigSnapshot } from './types';
