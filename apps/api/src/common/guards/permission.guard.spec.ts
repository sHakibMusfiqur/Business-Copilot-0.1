import { type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PermissionGuard } from './permission.guard';
import { Permissions, PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { RbacService } from '../../rbac/rbac.service';

interface MockRequest {
  user?: { id: string; organizationId?: string };
}

function makeReflector(requirement: unknown): Reflector {
  return {
    getAllAndOverride: jest.fn((key: string) => (key === PERMISSIONS_KEY ? requirement : undefined)),
  } as unknown as Reflector;
}

function makeRbac(userHasAll?: boolean, userHasAny?: boolean): RbacService {
  return {
    userHasAllPermissions: jest.fn().mockResolvedValue(userHasAll ?? false),
    userHasAnyPermission: jest.fn().mockResolvedValue(userHasAny ?? false),
  } as unknown as RbacService;
}

function makeContext(request: MockRequest): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('PermissionGuard', () => {
  it('allows when no @Permissions requirement is present', async () => {
    const guard = new PermissionGuard(makeReflector(undefined), makeRbac());
    await expect(guard.canActivate(makeContext({ user: { id: 'u1', organizationId: 'org-1' } }))).resolves.toBe(true);
  });

  it('allows when @Permissions has an empty list', async () => {
    const guard = new PermissionGuard(makeReflector({ permissions: [], mode: 'AND' }), makeRbac());
    await expect(guard.canActivate(makeContext({ user: { id: 'u1', organizationId: 'org-1' } }))).resolves.toBe(true);
  });

  it('rejects with Forbidden when no authenticated user is on the request', async () => {
    const guard = new PermissionGuard(makeReflector({ permissions: ['crm.read'], mode: 'AND' }), makeRbac());
    await expect(guard.canActivate(makeContext({}))).rejects.toThrow('User not authenticated');
  });

  it('rejects with Forbidden when the authenticated user has no organizationId', async () => {
    const guard = new PermissionGuard(makeReflector({ permissions: ['crm.read'], mode: 'AND' }), makeRbac());
    await expect(guard.canActivate(makeContext({ user: { id: 'u1' } }))).rejects.toThrow(
      'User does not belong to an organization',
    );
  });

  it('enforces AND mode by requiring every listed permission', async () => {
    const rbac = makeRbac(true);
    const guard = new PermissionGuard(
      makeReflector({ permissions: ['crm.read', 'crm.activities'], mode: 'AND' }),
      rbac,
    );
    await expect(guard.canActivate(makeContext({ user: { id: 'u1', organizationId: 'org-1' } }))).resolves.toBe(true);
    expect(rbac.userHasAllPermissions).toHaveBeenCalledWith('u1', 'org-1', ['crm.read', 'crm.activities']);
  });

  it('rejects with Forbidden in AND mode when any permission is missing', async () => {
    const rbac = makeRbac(false);
    const guard = new PermissionGuard(makeReflector({ permissions: ['crm.read'], mode: 'AND' }), rbac);
    await expect(guard.canActivate(makeContext({ user: { id: 'u1', organizationId: 'org-1' } }))).rejects.toThrow(
      'Insufficient permissions',
    );
    expect(rbac.userHasAnyPermission).not.toHaveBeenCalled();
  });

  it('enforces OR mode by requiring at least one listed permission', async () => {
    const rbac = makeRbac(undefined, true);
    const guard = new PermissionGuard(
      makeReflector({ permissions: ['billing.read', 'inventory.read'], mode: 'OR' }),
      rbac,
    );
    await expect(guard.canActivate(makeContext({ user: { id: 'u1', organizationId: 'org-1' } }))).resolves.toBe(true);
    expect(rbac.userHasAnyPermission).toHaveBeenCalledWith('u1', 'org-1', ['billing.read', 'inventory.read']);
  });

  it('rejects with Forbidden in OR mode when none of the permissions is present', async () => {
    const rbac = makeRbac(undefined, false);
    const guard = new PermissionGuard(
      makeReflector({ permissions: ['billing.read', 'inventory.read'], mode: 'OR' }),
      rbac,
    );
    await expect(guard.canActivate(makeContext({ user: { id: 'u1', organizationId: 'org-1' } }))).rejects.toThrow(
      'Insufficient permissions',
    );
  });

  it('never consults RbacService when there is no permission requirement', async () => {
    const rbac = makeRbac();
    const guard = new PermissionGuard(makeReflector(undefined), rbac);
    await guard.canActivate(makeContext({ user: { id: 'u1', organizationId: 'org-1' } }));
    expect(rbac.userHasAllPermissions).not.toHaveBeenCalled();
    expect(rbac.userHasAnyPermission).not.toHaveBeenCalled();
  });

  it('keeps @Permissions default mode to AND', () => {
    const handler = () => undefined;
    const target = { handler };
    const descriptor = { value: handler, writable: true, configurable: true };
    Permissions(['crm.read'])(target, 'handler', descriptor);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, target.handler as object)).toEqual({
      permissions: ['crm.read'],
      mode: 'AND',
    });
  });
});
