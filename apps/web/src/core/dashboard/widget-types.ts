import type { CapabilityKey, IndustryKey, RoleKey } from '@/core/types';
import type { WidgetKey, WidgetSpan, WidgetZone } from '@/core/workspace/types';

export type { WidgetKey, WidgetSpan, WidgetZone };/**

/** Any widget kind the engine may emit — built-in keys plus future extensions. */
export type WidgetKind = WidgetKey | (string & {});

/** Load state a widget is surfaced with to the renderer. */
export type WidgetLoadState = 'ready' | 'lazy' | 'loading' | 'fallback' | 'unknown';

/** Responsive column span recipe (col-span-<n> px→xl). */
export interface ResponsiveSpan {
  readonly base: string;
  readonly sm: string;
  readonly md: string;
  readonly lg: string;
  readonly xl: string;
}

/** A fully-resolved widget handed to the renderer. */
export interface DashboardWidget {
  readonly key: WidgetKind;
  /** Distinct visual group; may equal `key` when the renderer groups subtype. */
  readonly kind: WidgetKind;
  /** Data source key consumed by the runtime data adapter. */
  readonly source: string;
  readonly title?: string;
  readonly zone: WidgetZone;
  readonly span: WidgetSpan;
  /** Position within the zone (0 = first). */
  readonly order: number;
  readonly loadState: WidgetLoadState;
  readonly accent: string;
  /** Unique registration id (usually `key`) — stable across resolutions. */
  readonly id: string;
}

/** A zone with its ordered widgets. */
export interface DashboardZone {
  readonly zone: WidgetZone;
  readonly order: number;
  readonly widgets: readonly DashboardWidget[];
}

/** The resolved layout: ordered zones + responsive grid spans. */
export interface DashboardLayout {
  readonly columns: 12;
  readonly zones: readonly DashboardZone[];
}

/** Immutable output of the Dashboard Engine. */
export interface DashboardManifest {
  readonly id: string;
  /** Snapshot of the context that produced this manifest. */
  readonly context: DashboardContext;
  readonly widgets: readonly DashboardWidget[];
  readonly layout: DashboardLayout;
  /** Rendered widget count (ready + fallback present). */
  readonly widgetCount: number;
  /** True when any widget fell back to a placeholder. */
  readonly usedFallback: boolean;
}

/** Selection/visibility inputs the engine resolves against. */
export interface DashboardContext {
  readonly industry: IndustryKey;
  readonly role: RoleKey;
  readonly permissions: readonly string[];
  readonly aiEnabled: boolean;
  readonly enabledCapabilities: readonly CapabilityKey[];
  readonly enabledModules?: readonly string[];
  readonly installedPlugins?: readonly string[];
  readonly enabledFeatures?: readonly string[];
  readonly plan?: string;
  readonly tenantId?: string;
  readonly environment?: string;
  readonly accent: string;
  readonly roleLabel: string;
  readonly industryLabel: string;
  readonly headline: string;
  readonly subtitle: string;
}

/** Visibility inputs a widget can depend on (subset of context + widget decl). */
export interface WidgetVisibility {
  readonly roles?: readonly RoleKey[];
  readonly industries?: readonly IndustryKey[];
  readonly permission?: readonly string[];
  readonly module?: string;
  readonly aiRequired?: boolean;
  readonly capabilities?: readonly CapabilityKey[];
  readonly features?: readonly string[];
  readonly plan?: string;
  readonly plugins?: readonly string[];
  readonly environment?: string;
}