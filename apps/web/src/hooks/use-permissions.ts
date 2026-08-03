'use client';

import { useQuery } from '@tanstack/react-query';

import { getMyPermissions } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

export interface UsePermissionsResult {
  permissions: string[];
  isLoading: boolean;
  isLoaded: boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (...permissions: string[]) => boolean;
  hasAllPermissions: (...permissions: string[]) => boolean;
  refetch: () => Promise<unknown>;
}

export function usePermissions(): UsePermissionsResult {
  const user = useAuthStore((s) => s.user);
  const enabled = Boolean(user && user.organizationId);

  const query = useQuery<string[]>({
    queryKey: ['permissions', 'me'],
    queryFn: () => getMyPermissions(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const permissions = query.data ?? [];

  return {
    permissions,
    isLoading: query.isLoading,
    isLoaded: query.isSuccess,
    hasPermission: (permission: string) => permissions.includes(permission),
    hasAnyPermission: (...required: string[]) =>
      required.length === 0 ? true : required.some((p) => permissions.includes(p)),
    hasAllPermissions: (...required: string[]) => required.every((p) => permissions.includes(p)),
    refetch: () => query.refetch(),
  };
}
