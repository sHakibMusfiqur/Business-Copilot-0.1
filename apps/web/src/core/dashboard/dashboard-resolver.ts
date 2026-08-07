import { resolveVisibleWidgets, type BoundWidget, type WidgetRegistry } from './widget-registry';
import { ZONE_ORDER } from './widget-layout';
import type { WidgetLoader } from './widget-loader';
import type {
  DashboardContext,
  DashboardLayout,
  DashboardManifest,
  DashboardWidget,
  WidgetLoadState,
  WidgetZone,
} from './widget-types';

/** Dashboard Resolver dependencies. */
export interface DashboardResolverDeps {
  readonly registry: WidgetRegistry;
  readonly loader: WidgetLoader;
}

export class DashboardResolver {
  constructor(private readonly deps: DashboardResolverDeps) {}

  /** Resolve a dashboard from a context. Pure and deterministic. */
  resolve(context: DashboardContext): DashboardManifest {
    const { registry, loader } = this.deps;
const ordered = resolveVisibleWidgets(registry.all(), context);

    const widgets: DashboardWidget[] = ordered.map((widget) =>
      toDashboardWidget(widget, context, loader.stateOf(widget)),
    );

    return {
      id: manifestId(context),
      context,
      widgets,
      layout: buildLayout(widgets),
      widgetCount: widgets.length,
      usedFallback: widgets.some((widget) => widget.loadState === 'fallback'),
    };
  }
}

/** Normalize a bound declaration into a resolved renderable widget. */
function toDashboardWidget(
  widget: BoundWidget,
  context: DashboardContext,
  baseState: WidgetLoadState,
): DashboardWidget {
  return {
    key: widget.key,
    kind: widget.kind,
    source: widget.source,
    title: widget.title,
    zone: widget.zone,
    span: widget.span,
    order: widgetOrder(widget),
    loadState: baseState,
    accent: context.accent,
    id: widget.id,
  };
}

function widgetOrder(widget: BoundWidget): number {
  return widget.order ?? widget.priority;
}

/** Compose ordered, non-empty zones from a resolved widget set. */
function buildLayout(widgets: readonly DashboardWidget[]): DashboardLayout {
  const byZone = new Map<WidgetZone, DashboardWidget[]>();
  for (const widget of widgets) {
    const zone = byZone.get(widget.zone);
    if (zone) zone.push(widget);
    else byZone.set(widget.zone, [widget]);
  }
  const zones = ZONE_ORDER.map((zone, order): DashboardLayout['zones'][number] => ({
    zone,
    order,
    widgets: byZone.get(zone) ?? EMPTY_WIDGETS,
  })).filter((zone) => zone.widgets.length > 0);
  return { columns: 12, zones };
}

const EMPTY_WIDGETS: readonly DashboardWidget[] = [];

/** Stable manifest identity derived from the context. */
function manifestId(context: DashboardContext): string {
  return [context.role, context.industry, context.plan ?? 'none'].join('|');
}