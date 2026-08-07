import type { EnvironmentContext } from './platform/environment';
import { platformKernel } from './platform/kernel/bootstrap';
import type { ModuleRegistry } from './modules/registry';
import type { CapabilityEngine } from './capabilities/capabilities-engine';
import type { PermissionEngine } from './permissions/permission-engine';
import type { EntitlementEngine } from './entitlements/entitlement-engine';
import type { LayoutEngine } from './layout/layout-engine';
import type { ThemeEngine } from './theme/theme-engine';
import type { workspaceEngine } from './workspace/workspace-engine';

export interface CoreKernel {
  modules: ModuleRegistry;
  capabilities: CapabilityEngine;
  permissions: (permissions: string[]) => PermissionEngine;
  entitlements: EntitlementEngine;
  layout: LayoutEngine;
  theme: ThemeEngine;
  workspace: typeof workspaceEngine;
  environment: EnvironmentContext;
}

export function createCoreKernel(): CoreKernel {
  return {
    modules: platformKernel.engine<ModuleRegistry>('modules'),
    capabilities: platformKernel.engine<CapabilityEngine>('capabilities'),
    permissions: platformKernel.engine<(permissions: string[]) => PermissionEngine>('permissions'),
    entitlements: platformKernel.engine<EntitlementEngine>('entitlements'),
    layout: platformKernel.engine<LayoutEngine>('layout'),
    theme: platformKernel.engine<ThemeEngine>('theme'),
    workspace: platformKernel.engine<typeof workspaceEngine>('workspace'),
    environment: platformKernel.context.environment,
  };
}

export const kernel: CoreKernel = createCoreKernel();
