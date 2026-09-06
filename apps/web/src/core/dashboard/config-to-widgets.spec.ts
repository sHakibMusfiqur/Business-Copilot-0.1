import { describe, expect, it } from 'vitest';

import type { DashboardConfig, DashboardWidgetConfig } from '@/components/dashboard/types';
import type { DashboardWidget } from './widget-types';

import { configToWidgets, buildZonesFromWidgets } from './config-to-widgets';
import type { WidgetKey, WidgetSpan, WidgetZone } from '@/core/workspace/types';

const makeWidget = (overrides: Partial<DashboardWidgetConfig> = {}): DashboardWidgetConfig => ({
  id: 'test-widget',
  source: 'todaySales',
  key: 'metricCurrency',
  zone: 'hero',
  span: 3,
  supported: true,
  ...overrides,
});

const makeConfig = (overrides: Partial<DashboardConfig> = {}): DashboardConfig => ({
  industry: 'general',
  kpis: [],
  charts: [],
  secondary: [],
  alerts: [],
  insights: [],
  bottom: [],
  allWidgets: [],
  requiredSources: [],
  activeCapabilities: [],
  ...overrides,
});

function makeDashboardWidget(overrides: Partial<DashboardWidget> = {}): DashboardWidget {
  return {
    id: 'w1',
    key: 'metric' as WidgetKey,
    kind: 'metric',
    source: 'todaySales',
    zone: 'hero' as WidgetZone,
    span: 3 as WidgetSpan,
    order: 0,
    loadState: 'ready',
    accent: '#3B82F6',
    ...overrides,
  };
}

describe('configToWidgets', () => {
  it('converts KPI widgets to hero zone', () => {
    const config = makeConfig({
      kpis: [makeWidget({ id: 'revenue', source: 'todayRevenue' })],
    });
    const widgets = configToWidgets(config, '#3B82F6');
    expect(widgets).toHaveLength(1);
    expect(widgets[0].zone).toBe('hero');
    expect(widgets[0].source).toBe('todayRevenue');
    expect(widgets[0].accent).toBe('#3B82F6');
  });

  it('converts chart widgets to charts zone', () => {
    const config = makeConfig({
      charts: [makeWidget({ id: 'trend', source: 'revenue', key: 'revenueTrend', zone: 'charts', span: 8 })],
    });
    const widgets = configToWidgets(config, '#3B82F6');
    expect(widgets[0].zone).toBe('charts');
    expect(widgets[0].span).toBe(8);
  });

  it('converts secondary widgets to side zone', () => {
    const config = makeConfig({
      secondary: [makeWidget({ id: 'lowStock', source: 'lowStock', key: 'list', zone: 'side', span: 6 })],
    });
    const widgets = configToWidgets(config, '#3B82F6');
    expect(widgets[0].zone).toBe('side');
  });

  it('converts alert widgets to side zone', () => {
    const config = makeConfig({
      alerts: [makeWidget({ id: 'alert', source: 'lowStock', key: 'metric', zone: 'side', span: 4 })],
    });
    const widgets = configToWidgets(config, '#3B82F6');
    expect(widgets[0].zone).toBe('side');
  });

  it('converts insight widgets to insights zone', () => {
    const config = makeConfig({
      insights: [makeWidget({ id: 'ai', source: 'aiInsights', key: 'aiInsights', zone: 'insights', span: 12 })],
    });
    const widgets = configToWidgets(config, '#3B82F6');
    expect(widgets[0].zone).toBe('insights');
  });

  it('converts bottom widgets to bottom zone', () => {
    const config = makeConfig({
      bottom: [makeWidget({ id: 'activity', source: 'activity', key: 'activity', zone: 'bottom', span: 7 })],
    });
    const widgets = configToWidgets(config, '#3B82F6');
    expect(widgets[0].zone).toBe('bottom');
  });

  it('filters out unsupported widgets', () => {
    const config = makeConfig({
      kpis: [
        makeWidget({ id: 'supported', supported: true }),
        makeWidget({ id: 'unsupported', supported: false }),
      ],
    });
    const widgets = configToWidgets(config, '#3B82F6');
    expect(widgets).toHaveLength(1);
    expect(widgets[0].id).toBe('supported');
  });

  it('assigns incrementing order within zones', () => {
    const config = makeConfig({
      kpis: [
        makeWidget({ id: 'a' }),
        makeWidget({ id: 'b' }),
        makeWidget({ id: 'c' }),
      ],
    });
    const widgets = configToWidgets(config, '#3B82F6');
    expect(widgets[0].order).toBe(0);
    expect(widgets[1].order).toBe(1);
    expect(widgets[2].order).toBe(2);
  });

  it('sets loadState to ready', () => {
    const config = makeConfig({
      kpis: [makeWidget()],
    });
    const widgets = configToWidgets(config, '#3B82F6');
    expect(widgets[0].loadState).toBe('ready');
  });

  it('preserves widget title', () => {
    const config = makeConfig({
      kpis: [makeWidget({ title: 'Custom Title' })],
    });
    const widgets = configToWidgets(config, '#3B82F6');
    expect(widgets[0].title).toBe('Custom Title');
  });
});

describe('buildZonesFromWidgets', () => {
  it('groups widgets by zone in canonical order', () => {
    const widgets = [
      makeDashboardWidget({ id: '1', zone: 'charts', order: 0, key: 'revenueTrend', source: 'revenue', span: 8 }),
      makeDashboardWidget({ id: '2', zone: 'hero', order: 0, key: 'metric', source: 'todaySales', span: 3 }),
      makeDashboardWidget({ id: '3', zone: 'bottom', order: 0, key: 'activity', source: 'activity', span: 7 }),
    ];
    const zones = buildZonesFromWidgets(widgets);
    expect(zones.map((z) => z.zone)).toEqual(['hero', 'charts', 'bottom']);
  });

  it('orders widgets within a zone by order property', () => {
    const widgets = [
      makeDashboardWidget({ id: '2', zone: 'hero', order: 1, key: 'metric', source: 'b', span: 3 }),
      makeDashboardWidget({ id: '1', zone: 'hero', order: 0, key: 'metric', source: 'a', span: 3 }),
    ];
    const zones = buildZonesFromWidgets(widgets);
    expect(zones[0].widgets.map((w) => w.id)).toEqual(['1', '2']);
  });

  it('returns empty array for empty widgets', () => {
    const zones = buildZonesFromWidgets([]);
    expect(zones).toEqual([]);
  });

  it('skips empty zones', () => {
    const widgets = [
      makeDashboardWidget({ id: '1', zone: 'hero', order: 0, key: 'metric', source: 'a', span: 3 }),
    ];
    const zones = buildZonesFromWidgets(widgets);
    expect(zones).toHaveLength(1);
    expect(zones[0].zone).toBe('hero');
  });
});
