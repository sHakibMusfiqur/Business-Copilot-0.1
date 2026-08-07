// Platform
export { resolveEnvironment, PLATFORM_ROLE_KEYS, PLATFORM_INDUSTRY_KEYS } from './platform/environment';
export type { EnvironmentContext, BrowserContext, RuntimeContext, FeatureFlags } from './platform/environment';

// Modules
export { moduleRegistry, ModuleRegistry } from './modules/registry';
export { MODULE_CATEGORIES, DEFAULT_FAVORITES } from './modules/categories';
export { MODULE_MANIFESTS, MODULE_BY_ID } from './modules/definitions';
export { ModuleEngine } from './modules/engine';
export { ModuleLifecycle } from './modules/lifecycle';
export { ModuleControllerRegistry } from './modules/controller';
export type { ModuleManifest, ModuleCategory, ModuleSettings } from './modules/types';
export type {
  ModuleLifecycleStatus,
  ModuleController,
  ModuleControllerFactory,
  ModuleRuntimeContext,
  ModuleHealth,
  ModuleRuntimeSnapshot,
} from './modules/types';

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

// Dashboard Engine (Phase 3) — fully manifest-driven dashboard resolution.
export { createDashboardEngine, DashboardEngine } from './dashboard/dashboard-engine';
export type { DashboardEngineDeps } from './dashboard/dashboard-engine';
export { DashboardResolver } from './dashboard/dashboard-resolver';
export type { DashboardResolverDeps } from './dashboard/dashboard-resolver';
export { WidgetRegistry, resolveVisibleWidgets } from './dashboard/widget-registry';
export type { WidgetDeclaration, BoundWidget } from './dashboard/widget-registry';
export { WidgetLoader, FALLBACK_RENDERER, LOADING_RENDERER, UNKNOWN_RENDERER } from './dashboard/widget-loader';
export type { WidgetLoaderFn, WidgetModule, WidgetModuleFactory } from './dashboard/widget-loader';
export {
  ZONE_ORDER,
  spanTokens,
  zoneHasWidgets,
  zoneIndex,
} from './dashboard/widget-layout';
export { evaluateVisibility } from './dashboard/widget-visibility';
export { buildDashboardContext } from './dashboard/widget-context';
export type { DashboardContextExtras } from './dashboard/widget-context';
export type {
  WidgetKind,
  WidgetLoadState,
  ResponsiveSpan,
  DashboardWidget,
  DashboardZone,
  DashboardLayout,
  DashboardManifest,
  DashboardContext,
  WidgetVisibility,
} from './dashboard/widget-types';

// Workflow Engine (Phase 4) — declarative, trigger-driven business workflows.
export { WorkflowEngine, createWorkflowEngine } from './workflow/workflow-engine';
export type { WorkflowEngineBuses } from './workflow/workflow-engine';
export { WorkflowRegistry, createWorkflowRegistry } from './workflow/workflow-registry';
export type { WorkflowValidationReport, WorkflowValidation } from './workflow/workflow-registry';
export { WorkflowStepRegistry, createStepRegistry } from './workflow/step-registry';
export type { StepExecutionHooks, StepExecutor, StepExecutorRecord, StepByKind } from './workflow/step-registry';
export { WorkflowTriggerRegistry, createTriggerRegistry } from './workflow/trigger-registry';
export type { TriggerEvaluator, TriggerEvaluatorRecord, WorkflowTriggerSignal } from './workflow/trigger-registry';
export {
  WorkflowRunner,
  createWorkflowRunner,
} from './workflow/workflow-runner';
export type { WorkflowRunStore, RunOptions, WorkflowStepResult } from './workflow/workflow-runner';
export {
  parseCron,
  nextCron,
  matchesCron,
  nextInterval,
  scheduleOccurrences,
  CronParseError,
} from './workflow/scheduler';
export type { CronParts, ScheduleInput } from './workflow/scheduler';
export type {
  WorkflowCategory,
  WorkflowStatus,
  WorkflowRunStatus,
  WorkflowTriggerKind,
  WorkflowStepKind,
  WorkflowTrigger,
  WorkflowManualTrigger,
  WorkflowEventTrigger,
  WorkflowScheduleTrigger,
  WorkflowStep,
  WorkflowTaskStep,
  WorkflowCommandStep,
  WorkflowQueryStep,
  WorkflowConditionStep,
  WorkflowWaitStep,
  WorkflowSubflowStep,
  WorkflowEmitStep,
  WorkflowPluginStep,
  WorkflowDefinition,
  WorkflowRunContext,
  WorkflowRun,
  WorkflowRecord,
  WorkflowEngineSnapshot,
} from './workflow/types';

// Automation Engine (Phase 4) — rule-based automation over events & schedules.
export { createAutomationEngine, AutomationEngineImp } from './automation/automation-engine';
export type { AutomationEngine, AutomationEngineBuses } from './automation/automation-engine';
export { AutomationRegistry, createAutomationRegistry } from './automation/automation-registry';
export type { AutomationValidationReport, AutomationValidation } from './automation/automation-registry';
export { AutomationActionRegistry, createActionRegistry } from './automation/action-registry';
export type { ActionExecutor, ActionByKind, AutomationActionHooks } from './automation/action-registry';
export type {
  AutomationStatus,
  AutomationTriggerKind,
  AutomationActionKind,
  AutomationTrigger,
  AutomationEventTrigger,
  AutomationScheduleTrigger,
  AutomationManualTrigger,
  AutomationAction,
  AutomationNotifyAction,
  AutomationWorkflowAction,
  AutomationCommandAction,
  AutomationEventAction,
  AutomationLogAction,
  AutomationPluginAction,
  AutomationRule,
  AutomationContext,
  AutomationActionResult,
  AutomationEvaluation,
  AutomationRecord,
  AutomationEngineSnapshot,
} from './automation/types';

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

// Event Bus (Phase 2 Step 1)
export { EventBus, createEventBus } from './events/event-bus';
export type {
  EventMap,
  EventHandler,
  WildcardHandler,
  Unsubscribe,
  EventEnvelope,
  EventMiddleware,
  EventBusSnapshot,
} from './events/types';

// Command Bus (Phase 2 Step 2)
export { CommandBus, createCommandBus } from './commands/command-bus';
export type {
  Command,
  CommandResult,
  CommandOutcome,
  CommandHandler,
  CommandDefinition,
  CommandMiddleware,
  CommandValidator,
  CommandLogger,
  CommandRegistrySnapshot,
} from './commands/types';

// Query Bus (Phase 2 Step 3)
export { QueryBus, createQueryBus } from './queries/query-bus';
export type {
  Query,
  QueryResponse,
  QueryOptions,
  QueryHandler,
  QueryDefinition,
  CachedQuery,
  QueryBusSnapshot,
} from './queries/types';

// Plugin System (Phase 2 Step 4)
export {
  compareVersions,
  parseSemVer,
  satisfiesRange,
  PLUGIN_VERSION,
  PLUGIN_STATUSES,
} from './plugins/metadata';
export { PluginLifecycle } from './plugins/lifecycle';
export { PluginRegistry } from './plugins/registry';
export { PluginLoader } from './plugins/loader';
export type {
  PluginManifest,
  PluginDefinition,
  PluginHooks,
  PluginContext,
  PluginRecord,
  PluginMetadata,
  PluginStatus,
  PluginLoadResult,
  PluginRegistrySnapshot,
  VersionRange,
} from './plugins/types';

// Extension SDK (Phase 2 Step 6)
export { createExtensionSDK } from './sdk/extension-sdk';
export type {
  ExtensionSDK,
  ExtensionSdkSnapshot,
  ExtensionSdkDeps,
  ExtensionModuleContext,
  ModuleControllerAdapter,
  EventSurface,
  CommandSurface,
  QuerySurface,
} from './sdk/extension-sdk';

// Primitives
export type {
  RoleKey,
  IndustryKey,
  CapabilityKey,
  ModuleStatus,
  ModuleVisibility,
} from './types';
