import type { CapabilityKey } from '@bc/core';
import type { ResolvedWorkspace } from '@/core/workspace/types';
import { INDUSTRY_PROFILES } from '@/core/workspace/industries';

import type { DashboardContext } from './widget-types';

/** Optional additions layered over a resolved workspace. */
export interface DashboardContextExtras {
  readonly enabledModules?: readonly string[];
  readonly installedPlugins?: readonly string[];
  readonly enabledFeatures?: readonly string[];
  readonly plan?: string;
  readonly tenantId?: string;
  readonly environment?: string;
  readonly accent?: string;
  /** Override AI enablement (default: derived from granted capabilities). */
  readonly aiEnabled?: boolean;
}

/** Collapse workspace + extras into the context the engine resolves against. */
export function buildDashboardContext(
  workspace: ResolvedWorkspace,
  extras?: DashboardContextExtras,
): DashboardContext {
  const granted = workspace.capabilities?.granted ?? [];
  return {
    industry: workspace.industry,
    role: workspace.role,
    permissions: permissionsOf(workspace),
    aiEnabled: extras?.aiEnabled ?? granted.includes('ai'),
    enabledCapabilities: granted,
    enabledModules: extras?.enabledModules ?? workspace.enabledModuleIds,
    installedPlugins: extras?.installedPlugins,
    enabledFeatures: extras?.enabledFeatures,
    plan: extras?.plan,
    tenantId: extras?.tenantId ?? workspace.tenant.tenantId,
    environment: extras?.environment ?? workspace.environment?.runtime?.env,
    accent: extras?.accent ?? accentOf(workspace.industry),
    roleLabel: workspace.roleLabel,
    industryLabel: workspace.industryLabel,
    headline: workspace.manifest?.headline ?? '',
    subtitle: workspace.manifest?.subtitle ?? '',
  };
}

/** Industry accent (defaults to blue when the profile is unknown). */
function accentOf(industry: ResolvedWorkspace['industry']): string {
  return INDUSTRY_PROFILES[industry]?.accent ?? '#3B82F6';
}

/** Permissions threaded from enabled modules (the granted permission set). */
function permissionsOf(workspace: ResolvedWorkspace): string[] {
  return Array.from(new Set(workspace.modules.flatMap((module) => module.permissions)));
}

export type { CapabilityKey };