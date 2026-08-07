import type { RoleKey } from '@/core/types';

import type { PolicyDef } from './types';
import { resolveRoleKey } from './roles';

export interface PermissionEngine {
  permissions: readonly string[];
  has: (permission: string) => boolean;
  hasAny: (...permissions: string[]) => boolean;
  hasAll: (...permissions: string[]) => boolean;
  /** Returns a new engine whose grants include the policy's permissions. */
  withPolicy: (policy: PolicyDef) => PermissionEngine;
  /** Resolves the canonical workspace role key for this permission set. */
  role: (role?: string) => RoleKey;
}

export function createPermissionEngine(permissions: string[]): PermissionEngine {
  const engine: PermissionEngine = {
    permissions,
    has: (permission) => permissions.includes(permission),
    hasAny: (...required) => required.length === 0 || required.some((p) => permissions.includes(p)),
    hasAll: (...required) => required.every((p) => permissions.includes(p)),
    withPolicy: (policy) =>
      createPermissionEngine(Array.from(new Set([...permissions, ...policy.grants]))),
    role: (role) => resolveRoleKey(role, permissions),
  };
  return engine;
}
