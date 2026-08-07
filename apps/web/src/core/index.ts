// Platform
export { resolveEnvironment, PLATFORM_ROLE_KEYS, PLATFORM_INDUSTRY_KEYS } from './platform/environment';
export type { EnvironmentContext, BrowserContext, RuntimeContext, FeatureFlags } from './platform/environment';

// Modules
export { moduleRegistry } from './modules/registry';
export type { ModuleRegistry } from './modules/registry';
export { MODULE_CATEGORIES, DEFAULT_FAVORITES } from './modules/categories';
export { MODULE_MANIFESTS, MODULE_BY_ID } from './modules/definitions';
export type { ModuleManifest, ModuleCategory, ModuleSettings } from './modules/types';

// Capabilities
export { CAPABILITY_DEFINITIONS, CAPABILITY_ICONS } from './capabilities/capabilities';
export { createCapabilityEngine } from './capabilities/capabilities-engine';
export type { CapabilityDef, ResolvedCapabilities } from './capabilities/types';

// Permissions
export { ROLE_PROFILES, resolveRoleKey } from './permissions/roles';
export { POLICIES, POLICY_IDS } from './permissions/policies';
export { createPermissionEngine } from './permissions/permission-engine';
export type { RoleProfile, PolicyDef } from './permissions/types';

// Entitlements
export { PLAN_ENTITLEMENTS, FULL_ACCESS } from './entitlements/plans';
export { createEntitlementEngine } from './entitlements/entitlement-engine';
export type { PlanEntitlements, UsageLimits, EntitlementInput, EntitlementContext } from './entitlements/types';

// Navigation
export { buildNavigation } from './navigation/navigation-engine';
export type { NavItem, NavSection } from './navigation/types';

// Layout
export { LAYOUTS, LAYOUT_BY_ID, DEFAULT_LAYOUT_ID } from './layout/layouts';
export { layoutEngine } from './layout/layout-engine';
export type { LayoutDefinition, LayoutSpec, LayoutMode, LayoutRegions } from './layout/types';

// Theme
export { THEMES, THEME_BY_ID, DEFAULT_THEME_ID } from './theme/tokens';
export { themeEngine } from './theme/theme-engine';
export { STATUS_TONES, statusClasses } from './theme/widget-styles';
export type { ThemeDefinition, ThemeTokens, SpacingToken, RadiusToken, FontScaleToken, DensityToken } from './theme/types';

// Workspace
export { INDUSTRY_PROFILES, INDUSTRY_ICONS, INDUSTRY_LABELS } from './workspace/industries';
export { resolveWorkspace, resolveWidgetData, emptyStatistics, workspaceEngine } from './workspace/workspace-engine';
export { useWorkspace, WorkspaceProvider } from './workspace/workspace-context';
export { useWorkspaceStore, WORKSPACE_CONTEXT_STORAGE_KEY } from './workspace/store';
export { useCopilotActions } from './workspace/copilot-actions';
export type {
  WidgetDefinition,
  QuickActionDef,
  WorkspaceManifest,
  WorkspaceContextInput,
  IndustryProfile,
  TenantContext,
  WorkspaceContextValue,
  WidgetKey,
  WidgetSpan,
  WidgetZone,
} from './workspace/types';

// Kernel
export { kernel, createCoreKernel } from './kernel';
export type { CoreKernel } from './kernel';

// Platform Kernel (Phase 1.5)
export { bootstrapPlatform, platformKernel } from './platform/kernel/bootstrap';
export type { BootstrapOptions } from './platform/kernel/bootstrap';
export { PlatformKernel } from './platform/kernel/kernel';
export type { PlatformKernelOptions } from './platform/kernel/kernel';
export { EngineRegistry } from './platform/kernel/registry';
export { PlatformLifecycle } from './platform/kernel/lifecycle';
export { createPlatformContext, EMPTY_SESSION } from './platform/kernel/runtime';
export {
  PLATFORM_METADATA,
  BUILD_INFO,
  RESERVED_ENGINES,
  RESERVED_ENGINE_IDS,
} from './platform/kernel/metadata';
export type {
  PlatformMetadata,
  BuildInfo,
  PlatformSession,
  PlatformContext,
  PlatformStatus,
  EngineKind,
  EngineStatus,
  EngineHealth,
  EngineDescriptor,
  EngineRecord,
  EngineRegistrationInput,
  ReservedEngine,
} from './platform/kernel/types';

// Service Registry (Phase 1.5 Step 2)
export { ServiceRegistry } from './services/registry';export { ServiceLifecycle } from './services/lifecycle';
export {
  SERVICE_CATEGORIES,
  RESERVED_SERVICES,
  RESERVED_SERVICE_IDS,
} from './services/metadata';
export type {
  ServiceCategory,
  ServiceStatus,
  ServiceScope,
  ServiceHealthStatus,
  ServiceHealth,
  ServiceDescriptor,
  ServiceRecord,
  ServiceDefinition,
  ReservedService,
} from './services/types';

// Configuration Engine (Phase 1.5 Step 3)
export { ConfigEngine } from './config/engine';
export { DEFAULT_CONFIG, DEFAULT_CONFIG_BY_ID } from './config/metadata';
export {
  CONFIG_SCOPE_ORDER,
  CONFIG_SCOPE_RANK,
  CONFIG_VALUE_TYPES,
} from './config/constants';
export type {
  ConfigScope,
  ConfigValue,
  ConfigValueType,
  ConfigSource,
  ConfigMetadata,
  ConfigDefinition,
  ConfigEntry,
  ConfigValues,
  ConfigSnapshot,
} from './config/types';

// Design Token Engine (Phase 1.5 Step 4)
export { DesignTokenEngine, designTokens, ALL_TOKENS } from './design/engine';
export {
  FOUNDATION_TOKENS,
  SEMANTIC_TOKENS,
  MOTION_TOKENS,
  LAYOUT_TOKENS,
  resolveTokens,
  resolveOne,
  indexTokens,
  referencedIds,
  TokenReferenceError,
  buildSnapshot,
  TOKEN_CATEGORIES,
  TOKEN_GROUPS,
  TOKEN_TYPES,
  DESIGN_TOKEN_VERSION,
  describeCategories,
} from './design';
export type {
  TokenValue,
  TokenType,
  TokenCategory,
  TokenGroup,
  TokenMetadata,
  DesignToken,
  DesignTokenSnapshot,
  TokenCategoryDescriptor,
} from './design';

// Feature Registry (Phase 1.5 Step 5)
export { FeatureRegistry, featureRegistry, DEFAULT_FEATURE_CATALOG } from './features/registry';
export {
  ALL_FEATURES,
  ALL_FEATURES_BY_ID,
  PLATFORM_FEATURES,
  BUSINESS_FEATURES,
  INTELLIGENCE_FEATURES,
  EXTENSIBILITY_FEATURES,
} from './features/catalog';
export { resolveFeatures, dependencyChainOf, buildDependencyGraph, validateDependencies, FeatureDependencyError } from './features/resolver';
export { buildSnapshot as buildFeatureSnapshot } from './features/snapshot';
export { FEATURE_CATEGORIES, FEATURE_STATUSES, FEATURE_SCOPES, FEATURE_REGISTRY_VERSION } from './features/metadata';
export type {
  FeatureCategory,
  FeatureStatus,
  FeatureScope,
  FeatureMetadata,
  FeatureDefinition,
  ResolvedFeature,
  FeatureSnapshot,
  FeatureCategoryDescriptor,
  FeatureStatusDescriptor,
} from './features';

// Error Engine (Phase 1.5 Step 6)
export { ErrorEngine, errorEngine } from './errors/registry';
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
} from './errors/factory';
export { normalize, from, wrap } from './errors/normalizer';
export { DEFAULT_ERROR_CATALOG, DEFAULT_ERROR_CODE_INDEX } from './errors/catalog';
export { ERROR_CATEGORIES, ERROR_SEVERITIES, ERROR_RECOVERABILITY, ERROR_ENGINE_VERSION } from './errors/metadata';
export type {
  ErrorCategory,
  ErrorSeverity,
  ErrorRecoverability,
  RetryPolicy,
  ErrorDefinition,
  ErrorMetadata,
  ErrorInit,
  ErrorSnapshot,
  ErrorCategoryDescriptor,
} from './errors';

// Logger Engine (Phase 1.5 Step 7)
export { LoggerEngine, loggerEngine } from './logger/registry';
export { Logger } from './logger/factory';
export type { LogSink, LoggerOptions } from './logger/factory';
export {
  LOG_LEVELS,
  LOG_LEVEL_RANK,
  LOG_CATEGORIES,
  LOGGER_ENGINE_VERSION,
  levelRank,
} from './logger/metadata';
export type {
  LogLevel,
  LogCategory,
  LogContext,
  LogEntry,
  LoggerDefinition,
  LoggerSnapshot,
} from './logger';
export type { LogLevelDescriptor, LogCategoryDescriptor } from './logger/metadata';

// Identity Engine (Phase 1.5 Step 8)
export { IdentityEngine, identityEngine } from './identity/registry';
export { IDENTITY_CATALOG } from './identity/catalog';
export {
  IDENTITY_ENGINE_VERSION,
  IDENTITY_KINDS,
  IDENTITY_NAMESPACES,
  isNamespace,
  isValidId,
  qualify,
  IdentityError,
} from './identity/metadata';
export { resolveCatalog } from './identity/resolver';
export type {
  IdentityKind,
  IdentityNamespace,
  IdentityMetadata,
  IdentityEntry,
  IdentityInput,
  IdentitySnapshot,
} from './identity';

// Shared Utilities Foundation (Phase 1.5 Step 10)
export * from './utils';

// Primitives
export type {
  RoleKey,
  IndustryKey,
  CapabilityKey,
  ModuleStatus,
  ModuleVisibility,
} from './types';
