'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Loader2,
  ArrowUpDown,
} from 'lucide-react';
import { useState, useEffect } from 'react';

import { getAdminUsers, getAdminOrganizations } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: orgsData } = useQuery({
    queryKey: ['admin', 'organizations', 'all'],
    queryFn: () => getAdminOrganizations(1, 100),
    staleTime: 60_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', page, debouncedSearch, orgFilter, roleFilter],
    queryFn: () => getAdminUsers(page, 20, debouncedSearch || undefined, orgFilter || undefined, roleFilter || undefined),
    staleTime: 15_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform Users</h1>
        <p className="text-muted-foreground">View all users across every organization</p>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border bg-background pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <select
          value={orgFilter}
          onChange={(e) => { setOrgFilter(e.target.value); setPage(1); }}
          className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All Organizations</option>
          {orgsData?.data?.map((org: { id: string; name: string }) => (
            <option key={org.id} value={org.id}>{org.name}</option>
          ))}
        </select>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All Roles</option>
          <option value="SUPER_ADMIN">Super Admin</option>
          <option value="ADMIN">Admin</option>
          <option value="MANAGER">Manager</option>
          <option value="USER">User</option>
          <option value="VIEWER">Viewer</option>
        </select>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left">
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">
                  <div className="flex items-center gap-1">
                    User <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Organization</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Last Login</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Created</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </td>
                </tr>
              )}
              {!isLoading && data?.data?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    No users found
                  </td>
                </tr>
              )}
              {!isLoading && data?.data?.map((user: {
                id: string;
                name: string;
                email: string;
                role: string;
                isActive: boolean;
                avatar: string | null;
                organization: { id: string; name: string } | null;
                lastLoginAt: string | null;
                createdAt: string;
              }) => (
                <tr key={user.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {user.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={user.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                          {user.name?.charAt(0)?.toUpperCase() ?? 'U'}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      user.role === 'SUPER_ADMIN'
                        ? 'bg-red-500/10 text-red-600'
                        : user.role === 'ADMIN'
                        ? 'bg-violet-500/10 text-violet-600'
                        : 'bg-blue-500/10 text-blue-600'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {user.organization?.name ?? '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      user.isActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
                    }`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(user.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data?.meta && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} total)
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="rounded-lg border bg-background px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= data.meta.totalPages}
                className="rounded-lg border bg-background px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
