'use client';

import type { ComponentType } from 'react';

import { INDUSTRY_PROFILES } from '@/core/workspace/industries';
import type { DashboardOverview } from '@/components/dashboard/types';
import { resolveWidgetData } from '@/core/workspace/widget-data';
import type { WidgetDefinition, WidgetKey, WorkspaceManifest } from '@/core/workspace/types';

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

export function accentFor(widget: WidgetDefinition, manifest?: WorkspaceManifest | null): string {
  if (widget.key === 'trend' || widget.key === 'cashFlow') return '#3B82F6';
  if (manifest) {
    const industry = INDUSTRY_PROFILES[manifest.industry];
    if (industry) return industry.accent;
  }
  return '#3B82F6';
}

interface WidgetSurfaceProps {
  widget: WidgetDefinition;
  overview: DashboardOverview | null;
  manifest?: WorkspaceManifest | null;
  onCommand?: (command: string) => void;
}

/** Resolves a widget definition to its data payload and renders its component. */
export function WidgetSurface({ widget, overview, manifest, onCommand }: WidgetSurfaceProps) {
  const Component = REGISTRY[widget.key] ?? ListWidget;
  const data = resolveWidgetData(widget.source ?? widget.key, overview, accentFor(widget, manifest));
  return (
    <Component
      widget={widget}
      data={data}
      overview={overview}
      manifest={manifest ?? undefined}
      onCommand={onCommand}
    />
  );
}
