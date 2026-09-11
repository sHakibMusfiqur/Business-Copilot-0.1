'use client';

import { useState, useMemo } from 'react';
import { Shield, Pencil, Trash2, Copy, Users, Key, Search, ChevronLeft, ChevronRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDate, formatNumber } from '@/lib/utils';

import type { Role } from './rbac-types';

/* ─── Constants ──────────────────────────────────────────────────────────── */

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

/* ─── Component ──────────────────────────────────────────────────────────── */

interface RoleTableProps {
  roles: Role[];
  onEdit?: (role: Role) => void;
  onDelete?: (role: Role) => void;
  onDuplicate?: (role: Role) => void;
  onClonePermissions?: (role: Role) => void;
}

export function RoleTable({
  roles,
  onEdit,
  onDelete,
  onDuplicate,
  onClonePermissions,
}: RoleTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  /* ── Filter roles by search ──────────────────────────────────────────── */
  const filteredRoles = useMemo(() => {
    if (!searchQuery.trim()) return roles;
    const q = searchQuery.toLowerCase();
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)),
    );
  }, [roles, searchQuery]);

  /* ── Paginate ────────────────────────────────────────────────────────── */
  const totalPages = Math.max(1, Math.ceil(filteredRoles.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, filteredRoles.length);
  const visibleRoles = filteredRoles.slice(startIdx, endIdx);

  // Reset page when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  /* ── Empty state ─────────────────────────────────────────────────────── */
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
    <div className="rounded-lg border bg-background overflow-hidden">
      {/* Top controls */}
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search roles..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span>entries</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Permissions
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[140px]">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRoles.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-12 text-center text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No roles match your search</p>
                </td>
              </tr>
            ) : (
              visibleRoles.map((role) => (
                <tr
                  key={role.id}
                  className="border-b last:border-b-0 hover:bg-accent/30 transition-colors"
                >
                  {/* Role name + metadata */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Shield className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{role.name}</span>
                          {role.isSystem && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                              System
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {formatNumber(role.userCount)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Key className="h-3 w-3" />
                            {formatNumber(role.permissionCount)}
                          </span>
                          <span>{formatDate(role.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Permission chips */}
                  <td className="px-4 py-3">
                    <PermissionChips
                      permissions={role.permissions}
                      permissionCount={role.permissionCount}
                      isSystem={role.isSystem}
                    />
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {onEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(role)}
                          className="h-8 gap-1.5 text-xs"
                          title="Edit role"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                      )}
                      {onDuplicate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDuplicate(role)}
                          className="h-8 gap-1.5 text-xs"
                          title="Duplicate role"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {onClonePermissions && !role.isSystem && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onClonePermissions(role)}
                          className="h-8 gap-1.5 text-xs"
                          title="Clone permissions"
                        >
                          <Key className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {!role.isSystem && onDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(role)}
                          className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
                          title="Delete role"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filteredRoles.length > 0 && (
        <div className="flex items-center justify-between border-t px-4 py-2.5">
          <p className="text-xs text-muted-foreground">
            {filteredRoles.length === roles.length
              ? `Showing ${startIdx + 1}–${endIdx} of ${roles.length}`
              : `Showing ${startIdx + 1}–${endIdx} of ${filteredRoles.length} (filtered from ${roles.length})`}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-muted disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 text-xs text-muted-foreground">
              {safePage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-muted disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Permission Chips ───────────────────────────────────────────────────── */

const MAX_VISIBLE_CHIPS = 6;

function PermissionChips({
  permissions,
  permissionCount,
  isSystem,
}: {
  permissions?: string[];
  permissionCount: number;
  isSystem: boolean;
}) {
  if (permissionCount === 0) {
    return (
      <span className="text-xs text-muted-foreground italic">No permissions</span>
    );
  }

  // If we have actual permission names, show them as chips
  if (permissions && permissions.length > 0) {
    const visible = permissions.slice(0, MAX_VISIBLE_CHIPS);
    const remaining = permissions.length - MAX_VISIBLE_CHIPS;

    return (
      <div className="flex items-center gap-1 flex-wrap">
        {visible.map((perm) => (
          <Badge key={perm} variant="info" className="text-[10px] px-1.5 py-0 max-w-[140px] truncate" title={perm}>
            {perm}
          </Badge>
        ))}
        {remaining > 0 && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            +{remaining} more
          </Badge>
        )}
      </div>
    );
  }

  // Fallback: show count only
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Badge variant="info" className="text-[10px] px-1.5 py-0">
        {permissionCount} permission{permissionCount !== 1 ? 's' : ''}
      </Badge>
      {isSystem && (
        <Badge variant="warning" className="text-[10px] px-1.5 py-0">
          All access
        </Badge>
      )}
    </div>
  );
}
