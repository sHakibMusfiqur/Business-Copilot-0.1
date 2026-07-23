'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Shield, X, Users, Key, Calendar, Check } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatNumber } from '@/lib/utils';

import type { RoleDetails } from './rbac-types';

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
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold">{role.name}</h2>
                      {role.isSystem && (
                        <Badge variant="secondary" className="text-[10px]">System</Badge>
                      )}
                    </div>
                    {role.description && (
                      <p className="text-sm text-muted-foreground">{role.description}</p>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-4 mb-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{formatNumber(role.userCount)} users</span>
                </div>
                <div className="flex items-center gap-1">
                  <Key className="h-4 w-4" />
                  <span>{formatNumber(role.permissions.length)} permissions</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(role.createdAt)}</span>
                </div>
              </div>

              <div className="flex gap-2 mb-6">
                <Button onClick={onEditPermissions} size="sm" className="gap-1.5">
                  <Key className="h-4 w-4" />
                  Edit Permissions
                </Button>
                <Button onClick={onAssignUsers} variant="outline" size="sm" className="gap-1.5">
                  <Users className="h-4 w-4" />
                  Assign Users
                </Button>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Permissions
                </h3>

                {moduleKeys.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Key className="h-8 w-8 mb-2 opacity-30" />
                    <p className="text-sm">No permissions assigned</p>
                  </div>
                ) : (
                  moduleKeys.map((module) => (
                    <div key={module} className="rounded-lg border p-3">
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
