import { ForbiddenException } from '@nestjs/common';

import type { EntitlementInput, RoleKey, WorkspaceContextInput } from '@bc/core';

import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';


export interface WorkspaceRuntimeOptions {
  organizationName?: string;
  permissions?: string[];
  modules?: string[];
  plan?: string;
  /** Authoritative plan-derived entitlement (never caller-supplied). */
  entitlement?: EntitlementInput;
  aiEnabled?: boolean;
}

/** Thrown when the authenticated role has no safe canonical `RoleKey` mapping. */
export class UnsupportedRoleError extends Error {
  constructor(role: string) {
    super(`Cannot map authenticated role "${role}" to a canonical RoleKey`);
    this.name = 'UnsupportedRoleError';
  }
}


const ROLE_KEY_BY_NAME: Readonly<Record<string, RoleKey>> = {
  super_admin: 'super-admin',
  platform_super_admin: 'super-admin',
  superadmin: 'super-admin',
  admin: 'manager',
  ceo: 'ceo',
  executive: 'ceo',
  chief_executive: 'ceo',
  coo: 'coo',
  operations: 'coo',
  manager: 'manager',
  user: 'employee',
  finance: 'finance',
  accountant: 'finance',
  bookkeeper: 'finance',
  hr: 'hr',
  human_resources: 'hr',
  sales_rep: 'sales',
  salesperson: 'sales',
  warehouse: 'inventory',
  stock: 'inventory',
  support: 'support',
  service_desk: 'support',
  viewer: 'guest',
  read_only: 'guest',
};

function mapRole(role: string): RoleKey {
  const normalized = role.trim().toLowerCase();
  const mapped = ROLE_KEY_BY_NAME[normalized];
  if (mapped === undefined) {
    throw new UnsupportedRoleError(role);
  }
  return mapped;
}

/** Mirrors the tenant-context guard style used across the API controllers. */
function requireOrganizationId(user: CurrentUserPayload): string {
  if (!user.organizationId) {
    throw new ForbiddenException('User does not belong to an organization');
  }
  return user.organizationId;
}


export class WorkspaceContextAdapter {
  create(
    user: CurrentUserPayload,
    options: WorkspaceRuntimeOptions = {},
  ): WorkspaceContextInput {
    const tenantId = requireOrganizationId(user);
    const role = mapRole(user.role);

    const context = {} as WorkspaceContextInput;
    context.tenantId = tenantId;
    context.role = role;
    context.permissions = options.permissions ?? [];

    if (options.organizationName !== undefined) {
      context.organizationName = options.organizationName;
    }
    if (options.modules !== undefined) {
      context.modules = options.modules;
    }
    if (options.plan !== undefined) {
      context.plan = options.plan;
    }
    if (options.entitlement !== undefined) {
      context.entitlement = options.entitlement;
    }
    if (options.aiEnabled !== undefined) {
      context.aiEnabled = options.aiEnabled;
    }

    return context;
  }
}
