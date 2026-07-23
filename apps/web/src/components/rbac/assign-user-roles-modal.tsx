'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, X, Search, Loader2 } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { generateInitials } from '@/lib/utils';

import type { OrganizationUser, Role } from './rbac-types';

interface AssignUserRolesModalProps {
  open: boolean;
  onClose: () => void;
  users: OrganizationUser[];
  roles: Role[];
  isLoadingUsers: boolean;
  onAssign: (userId: string, roleIds: string[]) => Promise<void>;
}

export function AssignUserRolesModal({
  open,
  onClose,
  users,
  roles,
  isLoadingUsers,
  onAssign,
}: AssignUserRolesModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<OrganizationUser | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setSelectedUser(null);
      setSelectedRoleIds(new Set());
    }
  }, [open]);

  useEffect(() => {
    if (selectedUser) {
      setSelectedRoleIds(new Set(selectedUser.roleAssignments.map((ra) => ra.role.id)));
    }
  }, [selectedUser]);

  function toggleRole(roleId: string) {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
  }

  async function handleSave() {
    if (!selectedUser) return;
    setIsSaving(true);
    try {
      await onAssign(selectedUser.id, Array.from(selectedRoleIds));
      toast({ title: 'Roles updated', description: `Roles for "${selectedUser.name}" have been saved.` });
      setSelectedUser(null);
      setSelectedRoleIds(new Set());
    } catch {
      toast({ title: 'Error', description: 'Failed to assign roles.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }

  const filteredUsers = searchQuery
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.email.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : users;

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
            className="fixed inset-4 z-50 m-auto flex max-w-lg flex-col rounded-xl border bg-background shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Assign User Roles</h2>
                  <p className="text-xs text-muted-foreground">
                    {selectedUser ? `Editing: ${selectedUser.name}` : 'Select a user to assign roles'}
                  </p>
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
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingUsers ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-1.5 flex-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !selectedUser ? (
                <div className="space-y-1">
                  {filteredUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => setSelectedUser(u)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-accent/50 transition-colors"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {generateInitials(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      {u.roleAssignments.length > 0 && (
                        <Badge variant="secondary" className="text-[10px]">
                          {u.roleAssignments.length} role{u.roleAssignments.length !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </button>
                  ))}
                  {filteredUsers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">No users found</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/50">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {generateInitials(selectedUser.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{selectedUser.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-xs"
                      onClick={() => setSelectedUser(null)}
                    >
                      Change
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Available Roles
                    </p>
                    {roles.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No roles available</p>
                    ) : (
                      roles.map((role) => {
                        const isSelected = selectedRoleIds.has(role.id);
                        return (
                          <label
                            key={role.id}
                            className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/30 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleRole(role.id)}
                              className="rounded border-muted-foreground/30 h-4 w-4 accent-primary"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{role.name}</span>
                                {role.isSystem && (
                                  <Badge variant="secondary" className="text-[10px]">System</Badge>
                                )}
                              </div>
                              {role.description && (
                                <p className="text-xs text-muted-foreground truncate">{role.description}</p>
                              )}
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {selectedUser && (
              <div className="flex items-center justify-between border-t px-6 py-4">
                <span className="text-xs text-muted-foreground">
                  {selectedRoleIds.size} role{selectedRoleIds.size !== 1 ? 's' : ''} selected
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={onClose}>Cancel</Button>
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
