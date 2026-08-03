'use client';

import type { ReactNode } from 'react';

import { usePermissions } from '@/hooks/use-permissions';

interface RequirePermissionProps {
  permission?: string;
  any?: string[];
  all?: string[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequirePermission({
  permission,
  any,
  all,
  children,
  fallback = null,
}: RequirePermissionProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading } = usePermissions();

  let allowed: boolean;
  if (permission) {
    allowed = hasPermission(permission);
  } else if (any) {
    allowed = hasAnyPermission(...any);
  } else if (all) {
    allowed = hasAllPermissions(...all);
  } else {
    allowed = true;
  }

  if (isLoading && !allowed) {
    return null;
  }

  return <>{allowed ? children : fallback}</>;
}
