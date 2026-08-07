import type { WidgetKey, WidgetSpan, WidgetZone } from '@/core/workspace/types';

import type {
  DashboardContext,
  WidgetKind,
  WidgetVisibility,
} from './widget-types';
import { evaluateVisibility } from './widget-visibility';

/** Widget registration contract — a widget declares itself through this. */
export interface WidgetDeclaration {
  /** Unique widget identity (e.g. `revenue.trend`). Defaults to `key`. */
  readonly id?: string;
  /** Distinct renderer kind (e.g. `metric`, `trend`). */
  readonly key: WidgetKey;
  /** Visual subtype; defaults to `key`. Lets a kind render variants. */
  readonly kind?: WidgetKind;
  /** Default data source key when the widget does not declare one. */
  readonly source?: string;
  /** Display title. */
  readonly title?: string;
  readonly zone: WidgetZone;
  readonly span: WidgetSpan;
  /** Resolution order within a zone (lower = first). */
  readonly priority?: number;
  /** Declarative visibility rules evaluated against the context. */
  readonly visibility?: WidgetVisibility;
  /** Explicit order index. When set, wins over `priority` for zone ordering. */
  readonly order?: number;
}

/** Normalized internal record after registration. */
export interface BoundWidget {
  readonly id: string;
  readonly key: WidgetKey;
  readonly kind: WidgetKind;
  readonly source: string;
  readonly title?: string;
  readonly zone: WidgetZone;
  readonly span: WidgetSpan;
  readonly priority: number;
  readonly visibility?: WidgetVisibility;
  readonly order?: number;
}

export class WidgetRegistry {
  private readonly byId = new Map<string, BoundWidget>();

  /** Register a widget declaration. Returns false if the id is already bound. */
  register(widget: WidgetDeclaration): boolean {
    const bound = bindWidget(widget);
    if (this.byId.has(bound.id)) return false;
    this.byId.set(bound.id, bound);
    return true;
  }

  bind(widget: WidgetDeclaration): this {
    this.register(widget);
    return this;
  }

  /** Whether a widget id is registered. */
  has(id: string): boolean {
    return this.byId.has(id);
  }

  /** Get a bound widget record by id. */
  get(key: string): BoundWidget | undefined {
    return this.byId.get(key);
  }

  /** All registered, normalized widget records. */
  all(): readonly BoundWidget[] {
    return [...this.byId.values()];
  }
}

/** Normalize a declaration into a bound record with defaults applied. */
function bindWidget(widget: WidgetDeclaration): BoundWidget {
  return {
    id: widget.id ?? widget.key,
    key: widget.key,
    kind: widget.kind ?? widget.key,
    source: widget.source ?? widget.key,
    title: widget.title,
    zone: widget.zone,
    span: widget.span,
    priority: widget.priority ?? 0,
    visibility: widget.visibility,
    order: widget.order,
  };
}


export function resolveVisibleWidgets(
  widgets: readonly BoundWidget[],
  context: DashboardContext,
): BoundWidget[] {
  const visible = widgets.filter((widget) =>
    evaluateVisibility(widget, context),
  );
  return visible.sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
    if (a.order !== undefined) return a.order - b.priority;
    if (b.order !== undefined) return a.priority - b.order;
    return a.priority - b.priority;
  });
}

export type { WidgetKey, WidgetSpan, WidgetZone };