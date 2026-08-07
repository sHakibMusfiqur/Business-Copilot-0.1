'use client';

import { createContext, useContext, useEffect, useMemo } from 'react';

import { usePermissions } from '@/hooks/use-permissions';
import { useAuthStore } from '@/store/auth-store';

import { resolveRoleKey } from '@/core/permissions/roles';
import { WORKSPACE_CONTEXT_STORAGE_KEY, useWorkspaceStore } from './store';
import { resolveWorkspace } from './workspace-engine';
import type { IndustryKey, ResolvedWorkspace, RoleKey, WorkspaceContextValue } from './types';

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const { permissions, isLoaded, refetch } = usePermissions();

  const { industry, aiEnabled, hydrated, setIndustry, setAiEnabled, hydrate } =
    useWorkspaceStore();

  // Hydrate the persisted industry/ai context once on mount.
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Persist the resolved context so it survives reloads.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        WORKSPACE_CONTEXT_STORAGE_KEY,
        JSON.stringify({ industry, aiEnabled }),
      );
    } catch {
      // Ignore storage failures (private mode, quota).
    }
  }, [industry, aiEnabled, hydrated]);

  const role = useMemo(
    () => resolveRoleKey(user?.role, permissions),
    [user?.role, permissions],
  );

  const resolved = useMemo<ResolvedWorkspace>(
    () =>
      resolveWorkspace({
        role,
        industry,
        permissions,
        modules: [],
        aiEnabled,
        // Thread the authenticated user's org/tenant identity through instead of
        // relying on the engine's `''` default. Plan/org-size/name can be added
        // here once a dedicated tenant context is populated.
        tenantId: user?.organizationId ?? '',
      }),
    [role, industry, permissions, aiEnabled, user?.organizationId],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      resolved,
      role,
      industry: resolved.industry,
      industryLabel: resolved.industryLabel,
      aiEnabled,
      isResolving: !isLoaded || !hydrated,
      setIndustry,
      setAiEnabled,
      refresh: () => refetch(),
    }),
    [resolved, role, aiEnabled, isLoaded, hydrated, setIndustry, setAiEnabled, refetch],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return ctx;
}

export type { IndustryKey, RoleKey };
