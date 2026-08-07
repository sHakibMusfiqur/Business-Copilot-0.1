import { Download, Upload } from 'lucide-react';

import { INDUSTRY_LABELS, INDUSTRY_PROFILES } from '@/core/workspace/industries';
import { moduleRegistry } from '@/core/modules/registry';
import type { ModuleManifest } from '@/core/modules/types';
import { resolveRoleKey, ROLE_PROFILES } from '@/core/permissions/roles';
import type { WorkspaceContextInput, WorkspaceManifest, WidgetDefinition } from '@/core/workspace/types';
import { buildNavigation } from '@/core/navigation/navigation-engine';
import { createCapabilityEngine } from '@/core/capabilities/capabilities-engine';
import { createEntitlementEngine } from '@/core/entitlements/entitlement-engine';
import { layoutEngine } from '@/core/layout/layout-engine';
import { resolveEnvironment } from '@/core/platform/environment';
import type { ResolvedWorkspace } from '@/core/workspace/types';
import type { QuickActionDef } from '@/core/workspace/types';

function hasAny(permissions: string[], required?: string[]): boolean {
  if (!required || required.length === 0) return true;
  return required.some((p) => permissions.includes(p));
}

function resolveWidget(widget: WidgetDefinition, ctx: WorkspaceContextInput): boolean {
  if (widget.industries && !widget.industries.includes(ctx.industry ?? 'general')) return false;
  if (widget.roles && !widget.roles.includes(ctx.role ?? 'employee')) return false;
  if (!hasAny(ctx.permissions, widget.permission)) return false;
  if (widget.module && !(ctx.modules ?? []).includes(widget.module)) return false;
  if (widget.aiRequired && !ctx.aiEnabled) return false;
  return true;
}

function dedupeWidgets(widgets: WidgetDefinition[]): WidgetDefinition[] {
  const seen = new Set<string>();
  return widgets.filter((w) => {
    const id = `${w.source ?? w.key}-${w.zone}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function dedupeQuickActions(actions: QuickActionDef[]): QuickActionDef[] {
  const seen = new Set<string>();
  return actions.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}

function defaultQuickActions(): QuickActionDef[] {
  return [
    { id: 'import-csv', label: 'Import CSV', icon: Upload, permission: 'settings.manage', command: 'import.csv' },
    { id: 'export-pdf', label: 'Export PDF', icon: Download, permission: 'reports.read', command: 'reports.export' },
  ];
}

/**
 * Capability and entitlement engines are stateless resolvers. They are
 * created once here and reused across every `resolveWorkspace` call rather
 * than being re-instantiated per resolution.
 */
const capabilityEngine = createCapabilityEngine();
const entitlementEngine = createEntitlementEngine();

export function resolveWorkspace(input: WorkspaceContextInput): ResolvedWorkspace {
  const industry = input.industry && input.industry in INDUSTRY_PROFILES ? input.industry : 'general';
  const role = input.role ?? resolveRoleKey(undefined, input.permissions);

  const industryProfile = INDUSTRY_PROFILES[industry];
  const roleProfile = ROLE_PROFILES[role];

  const allModules = moduleRegistry.all();

  // Permissions that auto-gate a module on top of any explicit input modules.
  const permissionEnabled = allModules.filter((m) => {
    if (m.id === 'dashboard') return true;
    return hasAny(input.permissions, m.permissions);
  }).map((m) => m.id);

  const enabledModuleIds = Array.from(new Set([
    ...(input.modules ?? []),
    ...permissionEnabled,
  ]));

  const enabledModuleSet = new Set(enabledModuleIds);
  const enabledModules = allModules.filter((m) => enabledModuleSet.has(m.id));

  const ctx: WorkspaceContextInput = { ...input, modules: enabledModuleIds, industry, role };

  // Widgets: role widgets take priority, then industry widgets, then shared.
  const rawWidgets = [...roleProfile.widgets, ...industryProfile.widgets];
  const widgets = dedupeWidgets(rawWidgets.filter((w) => resolveWidget(w, ctx)));

  const navigation = buildNavigation(allModules, input.permissions);

  const quickActions: QuickActionDef[] = dedupeQuickActions([
    ...roleProfile.quickActions,
    ...defaultQuickActions(),
  ]).filter((q) => hasAny(input.permissions, q.permission ? [q.permission] : undefined));

  const capabilities = capabilityEngine.resolve(enabledModules, role);
  const entitlements = entitlementEngine.resolve({
    plan: input.plan,
    modules: enabledModuleIds,
  });
  const environment = resolveEnvironment();

  const manifest: WorkspaceManifest = {
    industry,
    role,
    roleLabel: roleProfile.label,
    widgets,
    navigation,
    quickActions,
    headline: roleProfile.headline,
    subtitle: industryProfile.subtitle,
  };

  return {
    industry,
    role,
    industryLabel: INDUSTRY_LABELS[industry] ?? 'Business',
    roleLabel: roleProfile.label,
    enabledModuleIds,
    modules: allModules,
    manifest,
    capabilities,
    entitlements,
    layout: layoutEngine.spec(),
    environment,
    tenant: {
      tenantId: input.tenantId ?? '',
      organizationName: input.organizationName,
    },
  };
}

export type { ModuleManifest };
