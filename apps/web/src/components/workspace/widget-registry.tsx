'use client';

import type { ComponentType } from 'react';

import type { DashboardOverview } from '@/components/dashboard/types';
import { resolveWidgetData } from '@/core/workspace/widget-data';
import type { WidgetKey, WorkspaceManifest } from '@/core/workspace/types';
import type { DashboardWidget } from '@/core/dashboard/widget-types';
import { LOADING_RENDERER, UNKNOWN_RENDERER } from '@/core/dashboard/widget-loader';

import {
  ActivityWidget,
  AiInsightsWidget,
  ApprovalsWidget,
  CalendarWidget,
  DonutWidget,
  ForecastWidget,
  HealthScoreWidget,
  ListWidget,
  MetricWidget,
  QuickActionsWidget,
  TrendWidget,
  type WorkspaceWidgetProps,
} from './widgets';


const REGISTRY: Record<WidgetKey, ComponentType<WorkspaceWidgetProps>> = {
  metric: MetricWidget,
  metricCurrency: MetricWidget,
  trend: TrendWidget,
  revenueTrend: TrendWidget,
  salesTrend: TrendWidget,
  cashFlow: TrendWidget,
  forecast: ForecastWidget,
  donut: DonutWidget,
  list: ListWidget,
  heatmap: ListWidget,
  activity: ActivityWidget,
  aiInsights: AiInsightsWidget,
  healthScore: HealthScoreWidget,
  approvals: ApprovalsWidget,
  calendar: CalendarWidget,
  quickActions: QuickActionsWidget,
};

interface DashboardWidgetSurfaceProps {
  widget: DashboardWidget;
  overview: DashboardOverview | null;
  manifest?: WorkspaceManifest | null;
  onCommand?: (command: string) => void;
}


export function DashboardWidgetSurface({ widget, overview, manifest, onCommand }: DashboardWidgetSurfaceProps) {
  const Component = rendererFor(widget);
  if (!Component) return <FallbackState state={widget.loadState} kind={widget.key} />;
  const data = resolveWidgetData(widget.source, overview, widget.accent);
  return (
    <Component
      widget={toLegacyWidget(widget)}
      data={data}
      overview={overview}
      manifest={manifest ?? undefined}
      onCommand={onCommand}
    />
  );
}


function FallbackState({ state, kind }: { state: DashboardWidget['loadState']; kind: string }) {
  const isPending = state === 'loading' || state === 'lazy';
  const label = isPending ? 'Loading widget' : state === 'unknown' ? `Unknown widget: ${kind}` : 'Widget unavailable';
  return (
    <div className="flex h-full min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-6">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
    </div>
  );
}


export function rendererFor(widget: DashboardWidget): ComponentType<WorkspaceWidgetProps> | null {
  if (widget.loadState === 'loading' || widget.loadState === 'lazy') return null;
  if (widget.loadState === 'unknown') return null;
  return widget.key in REGISTRY ? REGISTRY[widget.key as WidgetKey] : null;
}

function toLegacyWidget(widget: DashboardWidget) {
  return {
    key: widget.key as WidgetKey,
    span: widget.span,
    zone: widget.zone,
    source: widget.source,
  };
}

export { LOADING_RENDERER, UNKNOWN_RENDERER };