import type { LucideIcon } from 'lucide-react';

import type { EntitlementContext } from '@/core/entitlements/types';
import type { EnvironmentContext } from '@/core/platform/environment';
import type { LayoutSpec } from '@/core/layout/types';
import type { ResolvedCapabilities } from '@/core/capabilities/types';
import type { ModuleManifest } from '@/core/modules/types';
import type { NavSection } from '@/core/navigation/types';
import type {
  IndustryKey,
  QuickActionDef,
  RoleKey,
  WidgetDefinition,
} from '@/core/permissions/types';

export type {
  IndustryKey,
  RoleKey,
  WidgetKey,
  WidgetSpan,
  WidgetZone,
  WidgetDefinition,
  QuickActionDef,
} from '@/core/permissions/types';

export interface WorkspaceManifest {
  industry: IndustryKey;
  role: RoleKey;
  roleLabel: string;
  widgets: WidgetDefinition[];
  navigation: NavSection[];
  quickActions: QuickActionDef[];
  headline: string;
  subtitle: string;
}

/** Raw inputs the Workspace Engine resolves into a workspace context. */
export interface WorkspaceContextInput {
  industry?: IndustryKey | null;
  role?: RoleKey | null;
  permissions: string[];
  modules?: string[];
  aiEnabled: boolean;
  orgSize?: number;
  plan?: string;
  tenantId?: string;
  organizationName?: string;
}

export interface TenantContext {
  tenantId: string;
  organizationName?: string;
}

export interface ResolvedWorkspace {
  industry: IndustryKey;
  role: RoleKey;
  industryLabel: string;
  roleLabel: string;
  manifest: WorkspaceManifest;
  modules: ModuleManifest[];
  enabledModuleIds: string[];
  capabilities: ResolvedCapabilities;
  entitlements: EntitlementContext;
  layout: LayoutSpec;
  environment: EnvironmentContext;
  tenant: TenantContext;
}

export interface IndustryProfile {
  id: IndustryKey;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  widgets: WidgetDefinition[];
  defaultModules: string[];
  headline: string;
  subtitle: string;
  keywords: string[];
}

/** Extra context exposed by the Workspace React provider. */
export interface WorkspaceContextValue {
  resolved: ResolvedWorkspace;
  role: RoleKey;
  industry: IndustryKey;
  industryLabel: string;
  aiEnabled: boolean;
  isResolving: boolean;
  setIndustry: (industry: IndustryKey | null) => void;
  setAiEnabled: (aiEnabled: boolean) => void;
  refresh: () => Promise<unknown>;
}
