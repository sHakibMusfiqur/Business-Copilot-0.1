import type { ModuleManifest } from '@bc/core';

import { BUILTIN_MODULE_MANIFESTS } from './module-manifests';
import { WorkspacePermissionMapper } from './workspace-permission.mapper';

describe('WorkspacePermissionMapper (pure, data-driven mapping)', () => {
  const mapper = new WorkspacePermissionMapper();

  it('maps crm.read to the crm module and crm capability', () => {
    const access = mapper.map(['crm.read'], BUILTIN_MODULE_MANIFESTS);
    expect(access.moduleIds).toEqual(['crm']);
    expect(access.capabilities).toEqual(['crm']);
  });

  it('maps billing.read to the billing module with administration + platform capabilities', () => {
    const access = mapper.map(['billing.read'], BUILTIN_MODULE_MANIFESTS);
    expect(access.moduleIds).toEqual(['billing']);
    expect(access.capabilities).toEqual(['administration', 'platform']);
  });

  it('excludes a module when its required permission is removed', () => {
    const access = mapper.map(['billing.read'], BUILTIN_MODULE_MANIFESTS);
    expect(access.moduleIds).not.toContain('crm');
    expect(access.capabilities).not.toContain('crm');
  });

  it('merges access across multiple permissions', () => {
    const access = mapper.map(
      ['crm.read', 'billing.read'],
      BUILTIN_MODULE_MANIFESTS,
    );
    expect(access.moduleIds).toEqual(['billing', 'crm']);
    expect(access.capabilities).toEqual(['administration', 'crm', 'platform']);
  });

  it('ignores unknown permission strings (no hardcoded rules)', () => {
    const access = mapper.map(['foo.bar', 'crm.read'], BUILTIN_MODULE_MANIFESTS);
    expect(access.moduleIds).toEqual(['crm']);
    expect(access.capabilities).toEqual(['crm']);
    expect(access.permissions).toEqual(['crm.read', 'foo.bar']);
  });

  it('dedupes and deterministically sorts permissions/modules/capabilities', () => {
    const access = mapper.map(
      ['billing.read', 'crm.read', 'crm.read'],
      BUILTIN_MODULE_MANIFESTS,
    );
    expect(access.permissions).toEqual(['billing.read', 'crm.read']);
    expect(access.moduleIds).toEqual(['billing', 'crm']);
    expect(access.capabilities).toEqual(['administration', 'crm', 'platform']);
  });

  it('grants nothing with an empty permission set', () => {
    const access = mapper.map([], BUILTIN_MODULE_MANIFESTS);
    expect(access.moduleIds).toEqual([]);
    expect(access.capabilities).toEqual([]);
  });

  it('handles an empty manifest list', () => {
    const access = mapper.map(['crm.read'], []);
    expect(access.moduleIds).toEqual([]);
    expect(access.capabilities).toEqual([]);
    expect(access.permissions).toEqual(['crm.read']);
  });

  it('grants a module that declares no required permissions', () => {
    const settings: ModuleManifest = {
      id: 'settings',
      name: 'Settings',
      category: 'Administration',
      route: '/settings',
      permissions: [],
      capabilities: ['administration'],
      status: 'stable',
    };

    const access = mapper.map(['billing.read'], [settings]);
    expect(access.moduleIds).toEqual(['settings']);
    expect(access.capabilities).toEqual(['administration']);
  });

  it('is independent of manifest registration order', () => {
    const reversed = [...BUILTIN_MODULE_MANIFESTS].reverse();
    const expected = mapper.map(
      ['crm.read', 'billing.read'],
      BUILTIN_MODULE_MANIFESTS,
    );
    const actual = mapper.map(['crm.read', 'billing.read'], reversed);
    expect(actual).toEqual(expected);
  });

  it('does not grant modules from an unheld permission', () => {
    const access = mapper.map(['crm.read'], BUILTIN_MODULE_MANIFESTS);
    expect(access.moduleIds).not.toContain('billing');
    expect(access.capabilities).not.toContain('administration');
    expect(access.capabilities).not.toContain('platform');
  });

  it('preserves organization.manage without inventing module access', () => {
    const access = mapper.map(['organization.manage'], BUILTIN_MODULE_MANIFESTS);
    expect(access.permissions).toEqual(['organization.manage']);
    expect(access.moduleIds).toEqual([]);
    expect(access.capabilities).toEqual([]);
  });
});
