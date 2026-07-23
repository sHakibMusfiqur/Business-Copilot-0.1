'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, X, Check, Loader2, ChevronDown, ChevronRight, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';

import type { GroupedPermissions } from './rbac-types';

interface PermissionAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  roleId: string;
  roleName: string;
  initialPermissions: string[];
  groupedPermissions: GroupedPermissions | null;
  isLoadingPermissions: boolean;
  onSave: (permissionNames: string[]) => Promise<void>;
}

export function PermissionAssignmentDialog({
  open,
  onClose,
  roleId: _roleId,
  roleName,
  initialPermissions,
  groupedPermissions,
  isLoadingPermissions,
  onSave,
}: PermissionAssignmentDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setSelected(new Set(initialPermissions));
      if (groupedPermissions) {
        setExpandedModules(new Set(Object.keys(groupedPermissions)));
      }
    }
  }, [open, initialPermissions, groupedPermissions]);

  function togglePermission(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  function toggleModule(module: string, permissions: Array<{ name: string }>) {
    const allSelected = permissions.every((p) => selected.has(p.name));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of permissions) {
        if (allSelected) {
          next.delete(p.name);
        } else {
          next.add(p.name);
        }
      }
      return next;
    });
  }

  function toggleExpand(module: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(module)) {
        next.delete(module);
      } else {
        next.add(module);
      }
      return next;
    });
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSave(Array.from(selected));
      toast({ title: 'Permissions updated', description: `Permissions for "${roleName}" have been saved.` });
      onClose();
    } catch {
      toast({ title: 'Error', description: 'Failed to save permissions.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }

  const modules = groupedPermissions ? Object.entries(groupedPermissions).sort(([a], [b]) => a.localeCompare(b)) : [];
  const filteredModules = searchQuery
    ? modules.filter(([module, perms]) =>
        module.toLowerCase().includes(searchQuery.toLowerCase()) ||
        perms.some((p) => p.label.toLowerCase().includes(searchQuery.toLowerCase()) || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : modules;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-4 z-50 m-auto flex max-w-2xl flex-col rounded-xl border bg-background shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <Key className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Edit Permissions</h2>
                  <p className="text-xs text-muted-foreground">{roleName}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="px-6 py-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search permissions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingPermissions ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ))}
                </div>
              ) : filteredModules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Key className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm font-medium">No permissions found</p>
                  {searchQuery && (
                    <p className="text-xs mt-1">Try a different search term</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredModules.map(([module, perms]) => {
                    const isExpanded = expandedModules.has(module);
                    const allSelected = perms.every((p) => selected.has(p.name));
                    const someSelected = perms.some((p) => selected.has(p.name));

                    return (
                      <div key={module} className="rounded-lg border overflow-hidden">
                        <button
                          onClick={() => toggleExpand(module)}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium hover:bg-accent/50 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="capitalize">{module}</span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {perms.filter((p) => selected.has(p.name)).length}/{perms.length}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleModule(module, perms);
                            }}
                            className={`rounded p-0.5 transition-colors ${
                              allSelected ? 'text-emerald-500' : someSelected ? 'text-amber-500' : 'text-muted-foreground'
                            }`}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        </button>

                        {isExpanded && (
                          <div className="border-t divide-y">
                            {perms.map((perm) => (
                              <label
                                key={perm.id}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent/30 cursor-pointer transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={selected.has(perm.name)}
                                  onChange={() => togglePermission(perm.name)}
                                  className="rounded border-muted-foreground/30 h-4 w-4 accent-primary"
                                />
                                <div className="flex-1 min-w-0">
                                  <span>{perm.label}</span>
                                </div>
                                <span className="text-xs font-mono text-muted-foreground">{perm.name}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t px-6 py-4">
              <span className="text-xs text-muted-foreground">
                {selected.size} permission{selected.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
