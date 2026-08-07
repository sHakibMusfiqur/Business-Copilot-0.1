import type { LucideIcon } from 'lucide-react';

import type { IndustryKey, RoleKey } from '@/core/types';

/**
 * Shared widget/quick-action UI types. Defined here (the permission layer) so
 * `RoleProfile` can reference them without depending on the higher-level
 * workspace layer. Re-exported from `@/core/workspace/types` for compat.
 */
export type { IndustryKey, RoleKey };

/** Widget identifiers understood by the widget registry. */
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

/** Widget surface sizes on the 8pt grid (grid columns out of 12). */
export type WidgetSpan = 3 | 4 | 5 | 6 | 7 | 8 | 12;

/** Logical placement zones in the executive workspace. */
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
  icon: LucideIcon;
  permission?: string;
  shortcut?: string;
  command?: string;
}

/**
 * Declarative, data-driven resolution conditions for a role. When present,
 * `resolveRoleKey` can pick this role purely from its metadata — new roles
 * register automatically without touching resolution code.
 */
export interface RoleResolutionRule {
  /** Role name aliases (case/format-insensitive) that map directly to this role. */
  names?: string[];
  /** Every listed grant must be present for this role to match. */
  requireAll?: string[];
  /** Matches if at least one listed grant is present. */
  anyOf?: string[];
  /** When true, resolution requires organization-management scope (an admin user). */
  requiresAdmin?: boolean;
}

/**
 * Role profile — the role-facing view of the workspace (widgets, quick actions
 * and module scope) for a resolved role key.
 */
export interface RoleProfile {
  id: RoleKey;
  label: string;
  priority: number;
  headline: string;
  subtitle: string;
  widgets: WidgetDefinition[];
  quickActions: QuickActionDef[];
  modules: string[];
  icon: LucideIcon;
  /** Optional data-driven resolution descriptor (see `RoleResolutionRule`). */
  resolve?: RoleResolutionRule;
}

/** A named, reusable permission policy (composable grant sets). */
export interface PolicyDef {
  id: string;
  label: string;
  grants: string[];
}
