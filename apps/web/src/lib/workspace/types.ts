import type { LucideIcon } from 'lucide-react';

/** Canonical platform role profiles. */
export type RoleKey =
  | 'super-admin'
  | 'owner'
  | 'ceo'
  | 'coo'
  | 'manager'
  | 'finance'
  | 'hr'
  | 'sales'
  | 'inventory'
  | 'support'
  | 'employee'
  | 'guest';

/** Industry identifiers aligned with the provisioning templates. */
export type IndustryKey =
  | 'restaurant'
  | 'hospital'
  | 'manufacturing'
  | 'school'
  | 'software'
  | 'retail'
  | 'pharmacy'
  | 'garments'
  | 'it-services'
  | 'general';

/** Widget identifiers understood by the engine's widget registry. */
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
  /** Span on large screens (grid is 12 columns). */
  span: WidgetSpan;
  zone: WidgetZone;
  /** Industry ids this widget is tailored for; undefined = all industries. */
  industries?: IndustryKey[];
  /** Role keys that must hold for the widget to appear. */
  roles?: RoleKey[];
  /** Permission (any of) required. */
  permission?: string[];
  /** Module must be enabled. */
  module?: string;
  /** Only when AI features are enabled. */
  aiRequired?: boolean;
  /** Data-source adapter key, defaults to the widget key. */
  source?: string;
}

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  permission?: string;
  module?: string;
  pinned?: boolean;
  favorite?: boolean;
  children?: NavItem[];
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

export interface QuickActionDef {
  id: string;
  label: string;
  description?: string;
  href?: string;
  icon: LucideIcon;
  permission?: string;
  shortcut?: string;
  /** Executable command id for the AI copilot / command palette. */
  command?: string;
}

export interface WorkspaceManifest {
  industry: IndustryKey;
  role: RoleKey;
  /** Resolved role display context. */
  roleLabel: string;
  widgets: WidgetDefinition[];
  navigation: NavSection[];
  quickActions: QuickActionDef[];
  /** Greeting header for the executive workspace. */
  headline: string;
  subtitle: string;
}

export interface WorkspaceContextInput {
  industry?: IndustryKey | null;
  role?: RoleKey | null;
  permissions: string[];
  modules: string[];
  aiEnabled: boolean;
  orgSize?: number;
  plan?: string;
}

export interface IndustryProfile {
  id: IndustryKey;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  /** Accent hex used by industry widgets. */
  accent: string;
  /** Widget definitions contributed by this industry. */
  widgets: WidgetDefinition[];
  /** Module ids enabled by default for the industry. */
  defaultModules: string[];
  /** Headline overrides for the executive workspace. */
  headline: string;
  subtitle: string;
  /** Search terms used by the command palette. */
  keywords: string[];
}

export interface RoleProfile {
  id: RoleKey;
  label: string;
  /** Priority used to order quick actions. */
  priority: number;
  headline: string;
  subtitle: string;
  /** Widget definitions contributed by this role. */
  widgets: WidgetDefinition[];
  /** Quick actions contributed by this role. */
  quickActions: QuickActionDef[];
  /** Module ids this role can operate. */
  modules: string[];
  /** Icon used in role badges. */
  icon: LucideIcon;
}
