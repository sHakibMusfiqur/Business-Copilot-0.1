'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Shield, X, Key, Users, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getUserEffectivePermissions } from '@/lib/api';
import { generateInitials } from '@/lib/utils';

import type { EffectivePermissionsResponse, EffectivePermission } from './rbac-types';

interface EffectivePermissionsDrawerProps {
  userId: string | null;
  open: boolean;
  onClose: () => void;
}

function PermissionRow({ perm }: { perm: EffectivePermission }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/30 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{perm.label}</p>
          <p className="text-xs text-muted-foreground font-mono">{perm.name}</p>
        </div>
        <Badge variant="secondary" className="text-[10px] shrink-0">
          {perm.sourceRoles.length} source{perm.sourceRoles.length !== 1 ? 's' : ''}
        </Badge>
      </button>
      {expanded && (
        <div className="border-t bg-muted/20 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Granted by
          </p>
          <div className="flex flex-wrap gap-1.5">
            {perm.sourceRoles.map((role) => (
              <Badge key={role.id} variant="outline" className="text-xs">
                {role.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DrawerSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function EffectivePermissionsDrawer({ userId, open, onClose }: EffectivePermissionsDrawerProps) {
  const query = useQuery<EffectivePermissionsResponse>({
    queryKey: ['users', userId, 'effective-permissions'],
    queryFn: () => getUserEffectivePermissions(userId as string),
    enabled: open && Boolean(userId),
  });

  const data = query.data;
  const permissions = data?.permissions ?? [];
  const roles = data?.roles ?? [];

  // Group permissions by module
  const groupedByModule = permissions.reduce<Record<string, EffectivePermission[]>>((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = [];
    }
    acc[perm.module].push(perm);
    return acc;
  }, {});

  const moduleKeys = Object.keys(groupedByModule).sort();

  return (
    <AnimatePresence>
      {open && userId && (
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
            aria-label="Effective permissions"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Effective Permissions</h2>
                    <p className="text-sm text-muted-foreground">Complete permission set from all roles</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close effective permissions">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {query.isLoading ? (
                <DrawerSkeleton />
              ) : query.isError ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <p className="text-sm font-medium mb-3">Could not load effective permissions</p>
                  <Button variant="outline" size="sm" onClick={() => query.refetch()} className="gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry
                  </Button>
                </div>
              ) : (
                <>
                  {/* User identity */}
                  {data?.user && (
                    <div className="flex items-center gap-3 mb-6 p-3 rounded-lg bg-accent/50">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {generateInitials(data.user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{data.user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{data.user.email}</p>
                      </div>
                    </div>
                  )}

                  {/* Assigned roles */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Assigned Roles
                      </h3>
                      <Badge variant="secondary" className="text-[10px]">{roles.length}</Badge>
                    </div>
                    {roles.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No roles assigned</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {roles.map((role) => (
                          <Badge key={role.id} variant={role.isSystem ? 'default' : 'outline'} className="text-xs">
                            {role.name}
                            {role.isSystem && <span className="ml-1 text-[10px]">(System)</span>}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Effective permissions summary */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Effective Permissions
                      </h3>
                      <Badge variant="secondary" className="text-[10px]">{permissions.length}</Badge>
                    </div>
                  </div>

                  {/* Permissions grouped by module */}
                  {moduleKeys.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <Key className="h-8 w-8 mb-2 opacity-30" />
                      <p className="text-sm">No permissions assigned</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {moduleKeys.map((module) => (
                        <div key={module}>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                            {module}
                          </h4>
                          <div className="space-y-1.5">
                            {groupedByModule[module].map((perm) => (
                              <PermissionRow key={perm.id} perm={perm} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
