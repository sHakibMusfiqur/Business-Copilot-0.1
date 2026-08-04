'use client';

import { createContext, useContext, useEffect, useMemo } from 'react';

import { usePermissions } from '@/hooks/use-permissions';
import { useAuthStore } from '@/store/auth-store';

import { resolveWorkspace, type ResolvedWorkspace } from './manifest';
import { resolveRoleKey } from './roles';
import { WORKSPACE_CONTEXT_STORAGE_KEY, useWorkspaceStore } from './store';
import type { IndustryKey, RoleKey } from './types';

interface WorkspaceContextValue {
  /** Fully resolved manifest: widgets, navigation, quick actions, headline. */
  resolved: ResolvedWorkspace;
  role: RoleKey;
  industry: IndustryKey;
  industryLabel: string;
  aiEnabled: boolean;
  /** True while permissions are still loading (nav/wheelchairs not final). */
  isResolving: boolean;
  setIndustry: (industry: IndustryKey | null) => void;
  setAiEnabled: (aiEnabled: boolean) => void;
  refresh: () => Promise<unknown>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

/**
 * Resolves the dynamic workspace (role × industry × modules × permissions × AI)
 * for the signed-in user. Wrap the dashboard layout in this provider so the
 * sidebar, command palette and executive workspace share one manifest.
 */
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

  const resolved = useMemo(
    () =>
      resolveWorkspace({
        role,
        industry,
        permissions,
        modules: [],
        aiEnabled,
      }),
    [role, industry, permissions, aiEnabled],
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
