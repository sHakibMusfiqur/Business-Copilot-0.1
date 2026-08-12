import type { IndustryKey, RoleKey } from './identity';
import type { QuickActionDef, WidgetDefinition } from './permissions';

export type { QuickActionDef, WidgetDefinition };

export interface WorkspaceManifest {
  industry: IndustryKey;
  role: RoleKey;
  roleLabel: string;
  widgets: WidgetDefinition[];
  quickActions: QuickActionDef[];
  headline: string;
  subtitle: string;
}


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