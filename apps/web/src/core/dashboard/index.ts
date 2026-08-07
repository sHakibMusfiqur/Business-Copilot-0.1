export { createDashboardEngine, DashboardEngine } from './dashboard-engine';
export type { DashboardEngineDeps } from './dashboard-engine';
export { DashboardResolver } from './dashboard-resolver';
export type { DashboardResolverDeps } from './dashboard-resolver';
export { WidgetRegistry, resolveVisibleWidgets } from './widget-registry';
export type { WidgetDeclaration, BoundWidget } from './widget-registry';
export { WidgetLoader, FALLBACK_RENDERER, LOADING_RENDERER, UNKNOWN_RENDERER } from './widget-loader';
export type { WidgetLoaderFn, WidgetModule, WidgetModuleFactory } from './widget-loader';
export { ZONE_ORDER, spanTokens, zoneHasWidgets, zoneIndex } from './widget-layout';
export { evaluateVisibility } from './widget-visibility';
export { buildDashboardContext } from './widget-context';
export type { DashboardContextExtras } from './widget-context';
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
} from './widget-types';