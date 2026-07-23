'use client';

import { motion } from 'framer-motion';
import { Shield, Users, Key, MoreHorizontal } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDate, formatNumber } from '@/lib/utils';

import type { Role } from './rbac-types';

interface RoleListProps {
  roles: Role[];
  onSelect: (role: Role) => void;
  onDelete: (role: Role) => void;
}

export function RoleList({ roles, onSelect, onDelete }: RoleListProps) {
  if (roles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Shield className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm font-medium">No roles created yet</p>
        <p className="text-xs mt-1">Create your first role to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {roles.map((role, index) => (
        <motion.div
          key={role.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.03 }}
          className="glass-card rounded-xl p-4 flex items-center gap-4 hover:bg-accent/50 cursor-pointer transition-colors group"
          onClick={() => onSelect(role)}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{role.name}</span>
              {role.isSystem && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  System
                </Badge>
              )}
            </div>
            {role.description && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{role.description}</p>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              <span>{formatNumber(role.userCount)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Key className="h-3.5 w-3.5" />
              <span>{formatNumber(role.permissionCount)}</span>
            </div>
            <span>{formatDate(role.createdAt)}</span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onSelect(role)}>View Details</DropdownMenuItem>
              {!role.isSystem && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      onDelete(role);
                    }}
                  >
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </motion.div>
      ))}
    </div>
  );
}
