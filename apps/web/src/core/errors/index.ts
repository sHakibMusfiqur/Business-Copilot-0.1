/** Enterprise Error Engine — public surface. */
export { ErrorEngine, errorEngine } from './registry';
export {
  PlatformError,
  BusinessError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  InfrastructureError,
  ConfigurationError,
  FeatureError,
  ModuleError,
  WorkflowError,
  AutomationError,
  PluginError,
  IntegrationError,
  StorageError,
  SearchError,
  AIError,
  NotificationError,
  SchedulerError,
  SecurityError,
  UnknownError,
  createError,
  isPlatformError,
} from './factory';
export { normalize, from, wrap } from './normalizer';
export { buildSnapshot } from './snapshot';
export { DEFAULT_ERROR_CATALOG, DEFAULT_ERROR_CODE_INDEX } from './catalog';
export {
  ERROR_CATEGORIES,
  ERROR_SEVERITIES,
  ERROR_RECOVERABILITY,
  ERROR_ENGINE_VERSION,
  describeCategories,
} from './metadata';
export type { ErrorCategoryDescriptor } from './metadata';
export type {
  ErrorCategory,
  ErrorSeverity,
  ErrorRecoverability,
  RetryPolicy,
  ErrorDefinition,
  ErrorMetadata,
  ErrorInit,
  ErrorSnapshot,
} from './types';