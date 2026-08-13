import { ForbiddenException } from '@nestjs/common';

import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';

import {
  UnsupportedRoleError,
  WorkspaceContextAdapter,
  type WorkspaceRuntimeOptions,
} from './workspace-context.adapter';

function makeUser(overrides: Partial<CurrentUserPayload> = {}): CurrentUserPayload {
  return {
    id: 'user-1',
    email: 'owner@acme.com',
    role: 'MANAGER',
    organizationId: 'org-1',
    ...overrides,
  };
}

function makeOptions(overrides: WorkspaceRuntimeOptions = {}): WorkspaceRuntimeOptions {
  return overrides;
}

const adapter = new WorkspaceContextAdapter();

describe('WorkspaceContextAdapter', () => {
  it('maps organizationId to tenantId', () => {
    const context = adapter.create(makeUser(), makeOptions());
    expect(context.tenantId).toBe('org-1');
  });

  it('rejects a user with no organizationId using the tenant-context error style', () => {
    expect(() => adapter.create(makeUser({ organizationId: undefined }), makeOptions())).toThrow(
      ForbiddenException,
    );
    expect(() => adapter.create(makeUser({ organizationId: undefined }), makeOptions())).toThrow(
      'User does not belong to an organization',
    );
  });

  it('never allows caller options to override tenantId', () => {
    const context = adapter.create(
      makeUser(),
      // A hostile caller cannot smuggle a tenant/organization override in.
      makeOptions({ organizationName: 'Acme' }),
    );
    expect(context.tenantId).toBe('org-1');
    expect(Object.keys(context)).not.toContain('organizationId');
  });

  it('preserves organizationName when supplied', () => {
    const context = adapter.create(makeUser(), makeOptions({ organizationName: 'Acme Corp' }));
    expect(context.organizationName).toBe('Acme Corp');
  });

  it('omits organizationName when not supplied', () => {
    const context = adapter.create(makeUser(), makeOptions());
    expect(context.organizationName).toBeUndefined();
  });

  it('preserves permissions when supplied', () => {
    const permissions = ['crm.read', 'dashboard.read'];
    const context = adapter.create(makeUser(), makeOptions({ permissions }));
    expect(context.permissions).toEqual(['crm.read', 'dashboard.read']);
  });

  it('defaults permissions to an empty list when not supplied', () => {
    const context = adapter.create(makeUser(), makeOptions());
    expect(context.permissions).toEqual([]);
  });

  it('preserves enabled modules when supplied', () => {
    const context = adapter.create(makeUser(), makeOptions({ modules: ['crm', 'billing'] }));
    expect(context.modules).toEqual(['crm', 'billing']);
  });

  it('omits modules when not supplied', () => {
    const context = adapter.create(makeUser(), makeOptions());
    expect(context.modules).toBeUndefined();
  });

  it('preserves plan when supplied', () => {
    const context = adapter.create(makeUser(), makeOptions({ plan: 'growth' }));
    expect(context.plan).toBe('growth');
  });

  it('omits plan when not supplied', () => {
    const context = adapter.create(makeUser(), makeOptions());
    expect(context.plan).toBeUndefined();
  });

  it('preserves explicit aiEnabled=true', () => {
    const context = adapter.create(makeUser(), makeOptions({ aiEnabled: true }));
    expect(context.aiEnabled).toBe(true);
  });

  it('preserves explicit aiEnabled=false', () => {
    const context = adapter.create(makeUser(), makeOptions({ aiEnabled: false }));
    expect(context.aiEnabled).toBe(false);
  });

  it('omits aiEnabled when not explicitly supplied', () => {
    const context = adapter.create(makeUser(), makeOptions());
    expect(context.aiEnabled).toBeUndefined();
  });

  it('does not mutate the authenticated user object', () => {
    const user = makeUser();
    Object.freeze(user);
    const snapshot = JSON.stringify(user);
    adapter.create(user, makeOptions({ permissions: ['crm.read'], modules: ['crm'] }));
    expect(JSON.stringify(user)).toBe(snapshot);
    expect(user).toEqual(makeUser());
  });

  it('returns a fresh context object on every call', () => {
    const user = makeUser();
    const first = adapter.create(user, makeOptions());
    const second = adapter.create(user, makeOptions());
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });

  it('does not access Prisma, RBAC, or Billing (synchronous, pure mapping)', () => {
    const context = adapter.create(makeUser(), makeOptions({ permissions: ['crm.read'] }));
    // create() is fully synchronous: any Prisma/RBAC/Billing lookup would return
    // a Promise and require injected services, neither of which exist here.
    expect(context).not.toBeInstanceOf(Promise);
    expect(context).toEqual({
      tenantId: 'org-1',
      role: 'manager',
      permissions: ['crm.read'],
    });
  });

  it('is safe with empty optional options', () => {
    const context = adapter.create(makeUser(), makeOptions());
    expect(context.tenantId).toBe('org-1');
    expect(context.permissions).toEqual([]);
    expect(context.organizationName).toBeUndefined();
    expect(context.modules).toBeUndefined();
    expect(context.plan).toBeUndefined();
    expect(context.aiEnabled).toBeUndefined();
  });

  it('maps a supported authenticated role via the canonical mapping only', () => {
    expect(adapter.create(makeUser({ role: 'SUPER_ADMIN' }), makeOptions()).role).toBe('super-admin');
    expect(adapter.create(makeUser({ role: 'MANAGER' }), makeOptions()).role).toBe('manager');
    expect(adapter.create(makeUser({ role: 'VIEWER' }), makeOptions()).role).toBe('guest');
    expect(adapter.create(makeUser({ role: 'manager' }), makeOptions()).role).toBe('manager');
  });

  it('fails explicitly for an unsupported role instead of inventing one', () => {
    // 'ADMIN' (owner aliases) and 'USER' have no safe name-only canonical mapping.
    expect(() => adapter.create(makeUser({ role: 'ADMIN' }), makeOptions())).toThrow(
      UnsupportedRoleError,
    );
    expect(() => adapter.create(makeUser({ role: 'USER' }), makeOptions())).toThrow(
      UnsupportedRoleError,
    );
    expect(() => adapter.create(makeUser({ role: 'unknown_role' }), makeOptions())).toThrow(
      'Cannot map authenticated role "unknown_role" to a canonical RoleKey',
    );
  });
});
