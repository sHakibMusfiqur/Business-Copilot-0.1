import type { IndustryKey, RoleKey } from './identity';

export type { IndustryKey, RoleKey };


export type WidgetKey =
  | 'metric'
  | 'metricCurrency'
  | 'trend'
  | 'donut'
  | 'list'
  | 'activity'
  | 'aiInsights'
  | 'healthScore'
  | 'approvals'
  | 'forecast'
  | 'heatmap'
  | 'calendar'
  | 'quickActions'
  | 'cashFlow'
  | 'revenueTrend'
  | 'salesTrend';


export type WidgetSpan = 3 | 4 | 5 | 6 | 7 | 8 | 12;


export type WidgetZone = 'hero' | 'kpis' | 'charts' | 'insights' | 'side' | 'bottom';

export interface WidgetDefinition {
  key: WidgetKey;
  span: WidgetSpan;
  zone: WidgetZone;
  industries?: IndustryKey[];
  roles?: RoleKey[];
  permission?: string[];
  module?: string;
  aiRequired?: boolean;
  source?: string;
}

export interface QuickActionDef {
  id: string;
  label: string;
  description?: string;
  href?: string;
  permission?: string;
  shortcut?: string;
  command?: string;
}


export interface PolicyDef {
  id: string;
  label: string;
  grants: string[];
}