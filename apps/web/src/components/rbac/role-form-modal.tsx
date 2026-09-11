'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X, Loader2, Search, ShieldPlus, Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { createRole, updateRole, assignPermissions } from '@/lib/api';

import type { GroupedPermissions } from './rbac-types';
import { isPermissionGrantable, NON_DELEGABLE_PERMISSIONS } from './permission-gating';

/* ─── Module display names ───────────────────────────────────────────────── */

const MODULE_LABELS: Record<string, string> = {
  users: 'Staff',
  customers: 'Customers',
  suppliers: 'Suppliers',
  products: 'Products',
  inventory: 'Inventory',
  purchase: 'Purchases',
  sales: 'Sales',
  invoices: 'Invoices',
  employees: 'Employees',
  payroll: 'Payroll',
  crm: 'CRM',
  accounting: 'Accounting',
  payments: 'Payments',
  reports: 'Reports',
  dashboard: 'Dashboard',
  organization: 'Organization',
  settings: 'Settings',
  audit: 'Audit Logs',
  billing: 'Billing',
  ai: 'AI Copilot',
};

function moduleLabel(key: string): string {
  return MODULE_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/* ─── Permission parsing helpers ─────────────────────────────────────────── */

interface ResourceGroup {
  resource: string;
  permissions: Array<{ name: string; label: string; action: string }>;
}

interface ModuleGroup {
  module: string;
  label: string;
  resources: ResourceGroup[];
  allPermissionNames: string[];
}

/**
 * Parse a flat permission list into a module → resource → permission hierarchy.
 *
 * Permissions like `accounting.accounts.read` become:
 *   module: "accounting" → resource: "accounts" → action: "read"
 *
 * Simple permissions like `users.read` become:
 *   module: "users" → resource: "_actions" → action: "read"
 */
function buildModuleGroups(grouped: GroupedPermissions): ModuleGroup[] {
  const SUB_RESOURCE_PATTERN = /^([a-z]+)\.([a-z]+)\.([a-z]+)$/;

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([moduleKey, perms]) => {
      const resourceMap = new Map<string, Array<{ name: string; label: string; action: string }>>();

      for (const perm of perms) {
        const match = perm.name.match(SUB_RESOURCE_PATTERN);
        if (match) {
          const resource = match[2];
          const action = match[3];
          if (!resourceMap.has(resource)) resourceMap.set(resource, []);
          const arr = resourceMap.get(resource);
          if (arr) arr.push({ name: perm.name, label: perm.label, action });
        } else {
          const parts = perm.name.split('.');
          const action = parts[parts.length - 1];
          if (!resourceMap.has('_actions')) resourceMap.set('_actions', []);
          const arr = resourceMap.get('_actions');
          if (arr) arr.push({ name: perm.name, label: perm.label, action });
        }
      }

      const resources: ResourceGroup[] = Array.from(resourceMap.entries())
        .sort(([a], [b]) => {
          if (a === '_actions') return -1;
          if (b === '_actions') return 1;
          return a.localeCompare(b);
        })
        .map(([resource, permissions]) => ({
          resource,
          permissions: permissions.sort((a, b) => a.action.localeCompare(b.action)),
        }));

      return {
        module: moduleKey,
        label: moduleLabel(moduleKey),
        resources,
        allPermissionNames: perms.map((p) => p.name),
      };
    });
}

/* ─── Indeterminate checkbox hook ────────────────────────────────────────── */

function useIndeterminateCheckbox(
  _checked: boolean,
  indeterminate: boolean,
): React.RefObject<HTMLInputElement | null> {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);
  return ref;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

interface RoleFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Existing role data for edit mode. Null = create mode. */
  role?: {
    id: string;
    name: string;
    description?: string | null;
    isSystem: boolean;
    permissions: Array<{ name: string }>;
  } | null;
  groupedPermissions: GroupedPermissions | null;
  actorPermissions: string[];
  isLoadingPermissions: boolean;
  onSaved: () => void;
}

export function RoleFormModal({
  open,
  onClose,
  role,
  groupedPermissions,
  actorPermissions,
  isLoadingPermissions,
  onSaved,
}: RoleFormModalProps) {
  const { toast } = useToast();
  const isEdit = Boolean(role);

  /* ── Form state ──────────────────────────────────────────────────────── */
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [activeModule, setActiveModule] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Selected permissions per module: Map<moduleName, Set<permissionName>>
  const [selectedByModule, setSelectedByModule] = useState<Map<string, Set<string>>>(new Map());

  // Initialize form when modal opens
  useEffect(() => {
    if (open) {
      setRoleName(role?.name ?? '');
      setRoleDescription(role?.description ?? '');
      setSearchQuery('');
      setActiveModule('');

      if (role && groupedPermissions) {
        const init = new Map<string, Set<string>>();
        for (const perm of role.permissions) {
          const parts = perm.name.split('.');
          const moduleKey = parts[0];
          if (!init.has(moduleKey)) init.set(moduleKey, new Set());
          const set = init.get(moduleKey);
          if (set) set.add(perm.name);
        }
        setSelectedByModule(init);
      } else {
        setSelectedByModule(new Map());
      }
    }
  }, [open, role, groupedPermissions]);

  /* ── Build module groups ─────────────────────────────────────────────── */
  const moduleGroups = useMemo(
    () => (groupedPermissions ? buildModuleGroups(groupedPermissions) : []),
    [groupedPermissions],
  );

  // Auto-select first module tab
  useEffect(() => {
    if (open && moduleGroups.length > 0 && !activeModule) {
      setActiveModule(moduleGroups[0].module);
    }
  }, [open, moduleGroups, activeModule]);

  /* ── Selection helpers ───────────────────────────────────────────────── */
  const getModuleSelected = useCallback(
    (moduleKey: string): Set<string> => {
      return selectedByModule.get(moduleKey) ?? new Set();
    },
    [selectedByModule],
  );

  const setModuleSelected = useCallback((moduleKey: string, perms: Set<string>) => {
    setSelectedByModule((prev) => {
      const next = new Map(prev);
      if (perms.size === 0) {
        next.delete(moduleKey);
      } else {
        next.set(moduleKey, perms);
      }
      return next;
    });
  }, []);

  const togglePermission = useCallback(
    (moduleKey: string, permName: string) => {
      if (!isPermissionGrantable(permName, actorPermissions)) return;
      const current = getModuleSelected(moduleKey);
      const next = new Set(current);
      if (next.has(permName)) {
        next.delete(permName);
      } else {
        next.add(permName);
      }
      setModuleSelected(moduleKey, next);
    },
    [actorPermissions, getModuleSelected, setModuleSelected],
  );

  const toggleResource = useCallback(
    (moduleKey: string, permNames: string[]) => {
      const grantable = permNames.filter((n) => isPermissionGrantable(n, actorPermissions));
      if (grantable.length === 0) return;
      const current = getModuleSelected(moduleKey);
      const allSelected = grantable.every((n) => current.has(n));
      const next = new Set(current);
      for (const n of grantable) {
        if (allSelected) {
          next.delete(n);
        } else {
          next.add(n);
        }
      }
      setModuleSelected(moduleKey, next);
    },
    [actorPermissions, getModuleSelected, setModuleSelected],
  );

  const toggleModule = useCallback(
    (moduleKey: string, allPermNames: string[]) => {
      const grantable = allPermNames.filter((n) => isPermissionGrantable(n, actorPermissions));
      if (grantable.length === 0) return;
      const current = getModuleSelected(moduleKey);
      const allSelected = grantable.every((n) => current.has(n));
      const next = new Set(current);
      for (const n of grantable) {
        if (allSelected) {
          next.delete(n);
        } else {
          next.add(n);
        }
      }
      setModuleSelected(moduleKey, next);
    },
    [actorPermissions, getModuleSelected, setModuleSelected],
  );

  /* ── Module counts for tabs ──────────────────────────────────────────── */
  const moduleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const mg of moduleGroups) {
      counts[mg.module] = getModuleSelected(mg.module).size;
    }
    return counts;
  }, [moduleGroups, getModuleSelected]);

  const totalSelected = useMemo(() => {
    let count = 0;
    for (const [, perms] of selectedByModule) {
      count += perms.size;
    }
    return count;
  }, [selectedByModule]);

  /* ── Filtered modules for search ─────────────────────────────────────── */
  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return moduleGroups;
    const q = searchQuery.toLowerCase();
    return moduleGroups
      .map((mg) => ({
        ...mg,
        resources: mg.resources
          .map((rg) => ({
            ...rg,
            permissions: rg.permissions.filter(
              (p) =>
                p.name.toLowerCase().includes(q) ||
                p.label.toLowerCase().includes(q) ||
                p.action.toLowerCase().includes(q),
            ),
          }))
          .filter((rg) => rg.permissions.length > 0),
      }))
      .filter((mg) => mg.resources.length > 0);
  }, [moduleGroups, searchQuery]);

  /* ── Save handler ────────────────────────────────────────────────────── */
  async function handleSave() {
    if (!roleName.trim()) {
      toast({ title: 'Role name required', description: 'Please enter a role name.', variant: 'destructive' });
      return;
    }
    if (roleName.trim().length < 2) {
      toast({ title: 'Name too short', description: 'Role name must be at least 2 characters.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      let roleId: string;

      if (isEdit && role) {
        roleId = role.id;
        // Update name and description via PATCH endpoint
        await updateRole(roleId, {
          name: roleName.trim(),
          description: roleDescription.trim() || undefined,
        });
      } else {
        const created = await createRole({
          name: roleName.trim(),
          description: roleDescription.trim() || undefined,
        });
        roleId = created.id;
      }

      // Collect all selected permissions
      const allSelected: string[] = [];
      for (const [, perms] of selectedByModule) {
        for (const p of perms) {
          allSelected.push(p);
        }
      }

      // Filter to only grantable permissions
      const grantable = allSelected.filter((p) => isPermissionGrantable(p, actorPermissions));

      await assignPermissions(roleId, grantable);

      toast({
        title: isEdit ? 'Role updated' : 'Role created',
        description: isEdit
          ? `"${roleName.trim()}" has been updated with ${grantable.length} permissions.`
          : `Role "${roleName.trim()}" has been created with ${grantable.length} permissions.`,
      });
      onSaved();
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : `Failed to ${isEdit ? 'update' : 'create'} role.`,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  /* ── Active module data ──────────────────────────────────────────────── */
  const activeModuleData = filteredModules.find((m) => m.module === activeModule);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative z-50 flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border bg-background shadow-2xl mx-4"
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? `Edit role: ${role?.name}` : 'Create new role'}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              {isEdit ? (
                <Pencil className="h-4 w-4 text-primary" />
              ) : (
                <ShieldPlus className="h-4 w-4 text-primary" />
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold">
                {isEdit ? 'Edit Role' : 'Create New Role'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isEdit ? 'Modify role name and permissions' : 'Define a new role with specific permissions'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Role name */}
          <div className="px-6 pt-5 pb-3 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="role-name" className="mb-1.5 block text-sm font-medium">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="role-name"
                  placeholder="e.g. Manager"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  maxLength={50}
                />
              </div>
              <div>
                <Label htmlFor="role-desc" className="mb-1.5 block text-sm font-medium">
                  Description <span className="text-muted-foreground text-xs">(optional)</span>
                </Label>
                <Input
                  id="role-desc"
                  placeholder="e.g. Can manage team and view reports"
                  value={roleDescription}
                  onChange={(e) => setRoleDescription(e.target.value)}
                  maxLength={255}
                />
              </div>
            </div>
          </div>

          {/* Module tabs + Search */}
          <div className="border-t px-6 py-3">
            <div className="flex items-center gap-3 mb-3">
              {/* Module tabs */}
              <div className="flex-1 overflow-x-auto">
                <div className="flex gap-1 min-w-max">
                  {moduleGroups.map((mg) => {
                    const count = moduleCounts[mg.module] ?? 0;
                    const isActive = activeModule === mg.module;
                    return (
                      <button
                        key={mg.module}
                        onClick={() => setActiveModule(mg.module)}
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                        }`}
                        aria-selected={isActive}
                        role="tab"
                      >
                        {mg.label}
                        {count > 0 && (
                          <span
                            className={`ml-0.5 rounded-full px-1.5 py-0 text-[10px] font-semibold ${
                              isActive
                                ? 'bg-primary-foreground/20 text-primary-foreground'
                                : 'bg-primary/10 text-primary'
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Search */}
              <div className="relative w-56 shrink-0">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search permissions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Permission matrix */}
          <div className="flex-1 overflow-y-auto px-6 pb-2">
            {isLoadingPermissions ? (
              <div className="space-y-4 py-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-5 w-24 bg-muted rounded animate-pulse" />
                    <div className="h-8 w-full bg-muted rounded animate-pulse" />
                    <div className="h-8 w-full bg-muted rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : !activeModuleData ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <p className="text-sm font-medium">No permissions available</p>
              </div>
            ) : (
              <ModulePermissionPanel
                moduleGroup={activeModuleData}
                selected={getModuleSelected(activeModuleData.module)}
                actorPermissions={actorPermissions}
                onTogglePermission={(permName) => togglePermission(activeModuleData.module, permName)}
                onToggleResource={(permNames) => toggleResource(activeModuleData.module, permNames)}
                onToggleModule={(permNames) => toggleModule(activeModuleData.module, permNames)}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-6 py-4">
          <span className="text-xs text-muted-foreground">
            {totalSelected} permission{totalSelected !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !roleName.trim()}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? 'Update Role' : 'Create Role'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Permission Resource Group (individual component for hooks compliance) ─ */

interface PermissionResourceGroupProps {
  resourceGroup: ResourceGroup;
  moduleLabel: string;
  selected: Set<string>;
  actorPermissions: string[];
  onTogglePermission: (permName: string) => void;
  onToggleResource: (permNames: string[]) => void;
}

function PermissionResourceGroup({
  resourceGroup,
  moduleLabel,
  selected,
  actorPermissions,
  onTogglePermission,
  onToggleResource,
}: PermissionResourceGroupProps) {
  const resourcePermNames = resourceGroup.permissions.map((p) => p.name);
  const grantableRes = resourcePermNames.filter((n) => isPermissionGrantable(n, actorPermissions));
  const resAllSelected = grantableRes.length > 0 && grantableRes.every((n) => selected.has(n));
  const resSomeSelected = grantableRes.some((n) => selected.has(n));
  const resIndeterminate = resSomeSelected && !resAllSelected;
  const resCheckboxRef = useIndeterminateCheckbox(resAllSelected, resIndeterminate);
  const resSelectedCount = resourcePermNames.filter((n) => selected.has(n)).length;
  const isActionGroup = resourceGroup.resource === '_actions';

  return (
    <div className="rounded-lg border overflow-hidden">
      {/* Resource header */}
      <label className="flex items-center gap-3 px-4 py-2.5 bg-background hover:bg-accent/30 cursor-pointer transition-colors">
        <input
          ref={resCheckboxRef}
          type="checkbox"
          checked={resAllSelected}
          onChange={() => onToggleResource(resourcePermNames)}
          className="rounded border-muted-foreground/30 h-4 w-4 accent-primary"
          aria-label={`Select all ${isActionGroup ? 'permissions' : resourceGroup.resource} permissions`}
        />
        <span className="text-sm font-medium capitalize">
          {isActionGroup ? moduleLabel : resourceGroup.resource}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {resSelectedCount}/{resourceGroup.permissions.length}
        </span>
      </label>

      {/* Permission rows */}
      <div className="border-t divide-y">
        {resourceGroup.permissions.map((perm) => {
          const grantable = isPermissionGrantable(perm.name, actorPermissions);
          const checked = selected.has(perm.name);
          return (
            <label
              key={perm.name}
              className={`flex items-center gap-3 px-4 py-2 text-sm ${
                grantable
                  ? 'cursor-pointer hover:bg-accent/20 transition-colors'
                  : 'cursor-not-allowed bg-muted/20 opacity-60'
              }`}
              title={
                grantable
                  ? undefined
                  : NON_DELEGABLE_PERMISSIONS.has(perm.name)
                  ? 'Reserved for organization owners'
                  : 'You do not hold this permission'
              }
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={!grantable}
                onChange={() => onTogglePermission(perm.name)}
                className="rounded border-muted-foreground/30 h-4 w-4 accent-primary disabled:cursor-not-allowed"
                aria-label={perm.label}
              />
              <span className="flex-1 min-w-0 text-sm">{perm.label}</span>
              <span className="text-xs font-mono text-muted-foreground">{perm.name}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Module Permission Panel (inside the modal) ─────────────────────────── */

interface ModulePermissionPanelProps {
  moduleGroup: ModuleGroup;
  selected: Set<string>;
  actorPermissions: string[];
  onTogglePermission: (permName: string) => void;
  onToggleResource: (permNames: string[]) => void;
  onToggleModule: (permNames: string[]) => void;
}

function ModulePermissionPanel({
  moduleGroup,
  selected,
  actorPermissions,
  onTogglePermission,
  onToggleResource,
  onToggleModule,
}: ModulePermissionPanelProps) {
  const { resources, allPermissionNames } = moduleGroup;

  // Module-level select all state
  const grantableAll = allPermissionNames.filter((n) => isPermissionGrantable(n, actorPermissions));
  const allSelected = grantableAll.length > 0 && grantableAll.every((n) => selected.has(n));
  const someSelected = grantableAll.some((n) => selected.has(n));
  const moduleIndeterminate = someSelected && !allSelected;

  const moduleCheckboxRef = useIndeterminateCheckbox(allSelected, moduleIndeterminate);
  const selectedCount = allPermissionNames.filter((n) => selected.has(n)).length;

  return (
    <div className="space-y-3 pb-4">
      {/* Module select all */}
      <label className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors">
        <input
          ref={moduleCheckboxRef}
          type="checkbox"
          checked={allSelected}
          onChange={() => onToggleModule(allPermissionNames)}
          className="rounded border-muted-foreground/30 h-4 w-4 accent-primary"
          aria-label={`Select all ${moduleGroup.label} permissions`}
        />
        <span className="text-sm font-semibold">Select All {moduleGroup.label} Permissions</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {selectedCount}/{allPermissionNames.length}
        </span>
      </label>

      {/* Resource groups — each is its own component for hooks compliance */}
      {resources.map((rg) => (
        <PermissionResourceGroup
          key={rg.resource}
          resourceGroup={rg}
          moduleLabel={moduleGroup.label}
          selected={selected}
          actorPermissions={actorPermissions}
          onTogglePermission={onTogglePermission}
          onToggleResource={onToggleResource}
        />
      ))}
    </div>
  );
}
