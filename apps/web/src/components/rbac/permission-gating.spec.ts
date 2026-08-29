import { describe, it, expect } from 'vitest';

import { NON_DELEGABLE_PERMISSIONS, isPermissionGrantable } from './permission-gating';

describe('isPermissionGrantable', () => {
  it('returns true for a permission the actor holds', () => {
    expect(isPermissionGrantable('inventory.read', ['inventory.read', 'sales.read'])).toBe(true);
  });

  it('returns false when the actor does not hold the permission', () => {
    expect(isPermissionGrantable('inventory.create', ['inventory.read'])).toBe(false);
  });

  it('returns false for a non-delegable permission even when the actor holds it', () => {
    expect(isPermissionGrantable('organization.manage', ['organization.manage'])).toBe(false);
  });

  it('treats every non-delegable permission as blocked regardless of actor set', () => {
    for (const perm of NON_DELEGABLE_PERMISSIONS) {
      expect(isPermissionGrantable(perm, ['organization.manage', perm])).toBe(false);
    }
  });
});