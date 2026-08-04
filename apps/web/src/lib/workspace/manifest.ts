import { INDUSTRY_PROFILES } from './industries';
import { Download, Upload } from 'lucide-react';

import { INDUSTRY_LABELS, MODULES, type ModuleDef } from './modules';
import { resolveRoleKey, ROLE_PROFILES } from './roles';
import type {
  IndustryKey,
  NavSection,
  QuickActionDef,
  RoleKey,
  WorkspaceContextInput,
  WorkspaceManifest,
  WidgetDefinition,
} from './types';

/** Module groups rendered as sidebar sections, in order. */
const GROUP_ORDER = ['Workspace', 'Relations', 'Operations', 'Finance', 'People', 'Administration', 'Analytics'];

/** Modules that get pinned to the top of the sidebar as "Favorites". */
const DEFAULT_FAVORITES = ['dashboard', 'customers', 'accounting'];

export interface ResolvedWorkspace {
  industry: IndustryKey;
  role: RoleKey;
  industryLabel: string;
  roleLabel: string;
  manifest: WorkspaceManifest;
  modules: ModuleDef[];
  enabledModuleIds: string[];
}

function hasAny(permissions: string[], required?: string[]): boolean {
  if (!required || required.length === 0) return true;
  return required.some((p) => permissions.includes(p));
}

function hasAll(modules: string[], required?: string): boolean {
  if (!required) return true;
  return modules.includes(required);
}

function resolveWidget(
  widget: WidgetDefinition,
  ctx: WorkspaceContextInput,
): boolean {
  if (widget.industries && !widget.industries.includes(ctx.industry ?? 'general')) return false;
  if (widget.roles && !widget.roles.includes(ctx.role ?? 'employee')) return false;
  if (!hasAny(ctx.permissions, widget.permission)) return false;
  if (!hasAll(ctx.modules, widget.module)) return false;
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

/**
 * Builds the full workspace manifest from raw context. Pure function — the
 * executive workspace, sidebar and command palette all consume the output.
 */
export function resolveWorkspace(input: WorkspaceContextInput): ResolvedWorkspace {
  const industry: IndustryKey = input.industry && input.industry in INDUSTRY_PROFILES
    ? input.industry
    : 'general';
  const role: RoleKey = input.role ?? resolveRoleKey(undefined, input.permissions);

  const industryProfile = INDUSTRY_PROFILES[industry];
  const roleProfile = ROLE_PROFILES[role];

  // Enabled modules: permission-gated modules unioned with the caller's module
  // list (industry/role defaults). Widget module gates use this set.
  const enabledModuleIds = Array.from(new Set([
    ...(input.modules ?? []),
    ...MODULES.filter((m) => {
      if (m.id === 'dashboard') return true;
      const perms = m.permission ?? [];
      return perms.length === 0 || perms.some((p) => input.permissions.includes(p));
    }).map((m) => m.id),
  ]));

  const ctx: WorkspaceContextInput = { ...input, modules: enabledModuleIds, industry, role };

  // Widgets: role widgets take priority, then industry widgets, then shared.
  const rawWidgets = [...roleProfile.widgets, ...industryProfile.widgets];
  const widgets = dedupeWidgets(rawWidgets.filter((w) => resolveWidget(w, ctx)));

  const grouped = new Map<string, ModuleDef[]>();
  for (const mod of MODULES) {
    if (mod.id === 'dashboard') continue;
    const allowed = hasAny(input.permissions, mod.permission);
    if (!allowed) continue;
    const list = grouped.get(mod.group) ?? [];
    list.push(mod);
    grouped.set(mod.group, list);
  }

  const navigation: NavSection[] = [];
  for (const group of GROUP_ORDER) {
    const items = (grouped.get(group) ?? []).map((m) => ({
      id: m.id,
      label: m.label,
      href: m.href,
      icon: m.icon,
      permission: m.permission?.[0],
      module: m.id,
      pinned: m.id === 'dashboard' || DEFAULT_FAVORITES.includes(m.id),
      favorite: m.id === 'dashboard',
    }));
    if (items.length > 0) {
      navigation.push({ id: group, label: group, items });
    }
  }

  const quickActions: QuickActionDef[] = dedupeQuickActions([
    ...roleProfile.quickActions,
    ...defaultQuickActions(),
  ]).filter((q) => hasAny(input.permissions, q.permission ? [q.permission] : undefined));

  return {
    industry,
    role,
    industryLabel: INDUSTRY_LABELS[industry] ?? 'Business',
    roleLabel: roleProfile.label,
    enabledModuleIds,
    modules: MODULES,
    manifest: {
      industry,
      role,
      roleLabel: roleProfile.label,
      widgets,
      navigation,
      quickActions,
      headline: roleProfile.headline,
      subtitle: industryProfile.subtitle,
    },
  };
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
