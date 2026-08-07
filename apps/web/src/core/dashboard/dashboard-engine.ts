import { memoizeBy } from '@/core/utils/memo';

import { DashboardResolver } from './dashboard-resolver';
import type { DashboardContext, DashboardManifest } from './widget-types';
import { WidgetLoader } from './widget-loader';
import { WidgetRegistry, type WidgetDeclaration } from './widget-registry';

/** Engine configuration. */
export interface DashboardEngineDeps {
  readonly registry?: WidgetRegistry;
  readonly loader?: WidgetLoader;
  /** Seed declarations registered automatically on construction. */
  readonly defaultWidgets?: readonly WidgetDeclaration[];
}

/** Stable identity for a resolution context (drives the memo cache). */
function contextKey(context: DashboardContext): string {
  return [
    context.role,
    context.industry,
    context.plan ?? 'none',
    context.accent,
    context.environment ?? 'none',
    joinSet(context.enabledCapabilities),
    joinSet(context.permissions),
    joinSet(context.installedPlugins),
    joinSet(context.enabledFeatures),
    Boolean(context.aiEnabled),
  ].join('|');
}

function joinSet(values?: readonly string[]): string {
  if (!values || values.length === 0) return '';
  return [...values].sort().join(',');
}


export class DashboardEngine {
  readonly registry: WidgetRegistry;
  readonly loader: WidgetLoader;
  private readonly resolver: DashboardResolver;
  private readonly resolveOnce: {
    (context: DashboardContext): DashboardManifest;
    clear(): void;
  };

  constructor(deps?: DashboardEngineDeps) {
    this.registry = deps?.registry ?? new WidgetRegistry();
    this.loader = deps?.loader ?? new WidgetLoader();
    this.resolver = new DashboardResolver({ registry: this.registry, loader: this.loader });
    for (const widget of deps?.defaultWidgets ?? []) {
      this.registry.register(widget);
    }
    this.resolveOnce = memoizeBy(
      (context: DashboardContext) => this.resolver.resolve(context),
      contextKey,
    );
  }

  /** Register a widget declaration. Returns false when the key is taken. */
  registerWidget(widget: WidgetDeclaration): boolean {
    const added = this.registry.register(widget);
    if (added) this.resolveOnce.clear();
    return added;
  }

  /** Resolve a dashboard manifest (memoized per context). */
  resolve(context: DashboardContext): DashboardManifest {
    return this.resolveOnce(context);
  }

  /** Drop the memo cache (call when the widget set or environment changes). */
  invalidate(): void {
    this.resolveOnce.clear();
  }

  /** Engine introspection snapshot. */
  snapshot(): { widgetCount: number; kinds: string[] } {
    return {
      widgetCount: this.registry.all().length,
      kinds: this.registry.all().map((widget) => widget.kind),
    };
  }
}

/** Create a dashboard engine. */
export function createDashboardEngine(deps?: DashboardEngineDeps): DashboardEngine {
  return new DashboardEngine(deps);
}

export type { WidgetDeclaration, DashboardContext, DashboardManifest };