'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ShieldCheck, ShieldAlert, X, Users, Key, Calendar, Check, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatNumber, generateInitials } from '@/lib/utils';
import { getRoleUsers } from '@/lib/api';

import type { RoleDetails, RoleUser } from './rbac-types';

interface RoleDetailsDrawerProps {
  role: RoleDetails | null;
  open: boolean;
  onClose: () => void;
  onEditPermissions: () => void;
  onAssignUsers: () => void;
}

export function RoleDetailsDrawer({ role, open, onClose, onEditPermissions, onAssignUsers }: RoleDetailsDrawerProps) {
  const groupedPermissions = role?.permissions.reduce<Record<string, typeof role.permissions>>((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = [];
    }
    acc[perm.module].push(perm);
    return acc;
  }, {}) ?? {};

  const moduleKeys = Object.keys(groupedPermissions).sort();

  const roleId = role?.id;
  const usersQuery = useQuery<RoleUser[]>({
    queryKey: ['roles', roleId, 'users'],
    queryFn: () => getRoleUsers(roleId as string),
    enabled: open && Boolean(roleId),
  });

  const assignedUsers = usersQuery.data ?? [];
  const isSystem = Boolean(role?.isSystem);

  return (
    <AnimatePresence>
      {open && role && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-lg border-l bg-background shadow-xl overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-label={`${role.name} role details`}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${isSystem ? 'bg-amber-500/10' : 'bg-primary/10'}`}>
                    {isSystem ? <ShieldCheck className="h-5 w-5 text-amber-500" /> : <Shield className="h-5 w-5 text-primary" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold">{role.name}</h2>
                      {isSystem && (
                        <Badge variant="secondary" className="text-[10px]">System</Badge>
                      )}
                    </div>
                    {role.description && (
                      <p className="text-sm text-muted-foreground">{role.description}</p>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close role details">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {isSystem && (
                <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                  <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-700 dark:text-amber-400">Protected system role</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      This role is managed by the platform. Its permissions cannot be edited, duplicated, or deleted.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 mb-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-1" title="Assigned users">
                  <Users className="h-4 w-4" />
                  <span>{formatNumber(role.userCount)} users</span>
                </div>
                <div className="flex items-center gap-1" title="Assigned permissions">
                  <Key className="h-4 w-4" />
                  <span>{formatNumber(role.permissions.length)} permissions</span>
                </div>
                <div className="flex items-center gap-1" title={`Created ${formatDate(role.createdAt)}`}>
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(role.createdAt)}</span>
                </div>
              </div>

              <div className="mb-1.5 text-xs text-muted-foreground">
                Created {formatDate(role.createdAt)} · Updated {formatDate(role.updatedAt)}
              </div>

              <div className="flex gap-2 mb-6">
                {!isSystem && (
                  <Button onClick={onEditPermissions} size="sm" className="gap-1.5">
                    <Key className="h-4 w-4" />
                    Edit Permissions
                  </Button>
                )}
                <Button onClick={onAssignUsers} variant="outline" size="sm" className="gap-1.5">
                  <Users className="h-4 w-4" />
                  Assign Users
                </Button>
              </div>

              <div className="space-y-6">
                {/* Assigned users */}
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Assigned Users</h3>
                    <Link
                      href="/users"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <LinkIcon className="h-3.5 w-3.5" />
                      View in Users
                    </Link>
                  </div>

                  {usersQuery.isLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <Skeleton className="h-9 w-9 rounded-full" />
                          <div className="flex-1 space-y-1.5">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : usersQuery.isError ? (
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <p className="text-xs text-destructive">Could not load assigned users.</p>
                      <Button variant="outline" size="sm" onClick={() => usersQuery.refetch()}>
                        Retry
                      </Button>
                    </div>
                  ) : assignedUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-lg border py-8 text-muted-foreground">
                      <Users className="h-8 w-8 mb-2 opacity-30" />
                      <p className="text-sm">No users are assigned to this role.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {assignedUsers.map((user) => (
                        <div key={user.id} className="flex items-center gap-3 rounded-lg border p-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {generateInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium">{user.name}</p>
                              {!user.isActive && (
                                <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                              )}
                            </div>
                            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                          </div>
                          <div className="flex flex-wrap justify-end gap-1">
                            {user.roleAssignments.map((ra) => (
                              <Badge key={ra.role.id} variant={ra.role.id === role.id ? 'default' : 'secondary'} className="text-[10px]">
                                {ra.role.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Permissions */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Permissions</h3>

                  {moduleKeys.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <Key className="h-8 w-8 mb-2 opacity-30" />
                      <p className="text-sm">No permissions assigned</p>
                    </div>
                  ) : (
                    moduleKeys.map((module) => (
                      <div key={module} className="mb-3 rounded-lg border p-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          {module}
                        </h4>
                        <div className="space-y-1.5">
                          {groupedPermissions[module].map((perm) => (
                            <div key={perm.id} className="flex items-center gap-2 text-sm">
                              <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              <span>{perm.label}</span>
                              <span className="text-xs text-muted-foreground ml-auto font-mono">
                                {perm.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}