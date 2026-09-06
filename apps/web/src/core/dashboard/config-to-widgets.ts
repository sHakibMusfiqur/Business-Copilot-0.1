import type { DashboardConfig, DashboardWidgetConfig } from '@/components/dashboard/types';
import type { WidgetKey, WidgetSpan, WidgetZone } from '@/core/workspace/types';

import type { DashboardWidget, WidgetLoadState } from './widget-types';

const ZONE_ORDER: WidgetZone[] = ['hero', 'kpis', 'charts', 'insights', 'side', 'bottom'];


export function configToWidgets(config: DashboardConfig, accent: string): DashboardWidget[] {
  const zones: Array<{ zone: WidgetZone; widgets: DashboardWidgetConfig[] }> = [
    { zone: 'hero', widgets: config.kpis },
    { zone: 'charts', widgets: config.charts },
    { zone: 'side', widgets: config.secondary },
    { zone: 'side', widgets: config.alerts },
    { zone: 'insights', widgets: config.insights },
    { zone: 'bottom', widgets: config.bottom },
  ];

  const widgets: DashboardWidget[] = [];
  let order = 0;

  for (const { zone, widgets: zoneWidgets } of zones) {
    for (const w of zoneWidgets) {
      if (!w.supported) continue;
      widgets.push(toDashboardWidget(w, zone, order++, accent));
    }
  }

  return widgets;
}


function toDashboardWidget(
  config: DashboardWidgetConfig,
  zone: WidgetZone,
  order: number,
  accent: string,
): DashboardWidget {
  return {
    id: config.id,
    key: config.key as WidgetKey,
    kind: config.key as WidgetKey,
    source: config.source,
    title: config.title,
    zone: mapZone(config.zone as WidgetZone, zone),
    span: config.span as WidgetSpan,
    order,
    loadState: 'ready' as WidgetLoadState,
    accent,
  };
}

/** Map backend zone to frontend zone, using the declared zone when valid. */
function mapZone(declared: WidgetZone, fallback: WidgetZone): WidgetZone {
  return ZONE_ORDER.includes(declared) ? declared : fallback;
}


export function buildZonesFromWidgets(widgets: DashboardWidget[]): Array<{ zone: WidgetZone; widgets: DashboardWidget[] }> {
  const byZone = new Map<WidgetZone, DashboardWidget[]>();
  for (const widget of widgets) {
    const existing = byZone.get(widget.zone);
    if (existing) existing.push(widget);
    else byZone.set(widget.zone, [widget]);
  }

  return ZONE_ORDER
    .filter((zone) => byZone.has(zone))
    .map((zone) => ({
      zone,
      widgets: (byZone.get(zone) ?? []).sort((a, b) => a.order - b.order),
    }));
}
