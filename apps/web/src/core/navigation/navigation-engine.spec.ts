import { describe, expect, it } from 'vitest';

import type { ModuleManifest } from '@/core/modules/types';

import { buildNavigation } from './navigation-engine';

function manifest(overrides: Partial<ModuleManifest>): ModuleManifest {
  return {
    id: 'x',
    name: 'X',
    icon: {} as ModuleManifest['icon'],
    category: 'Operations',
    route: '/x',
    permissions: [],
    capabilities: [],
    status: 'stable',
    ...overrides,
  };
}

describe('buildNavigation', () => {
  it('keeps modules whose permission is held and drops those it is not', () => {
    const nav = buildNavigation(
      [
        manifest({ id: 'a', route: '/a', permissions: ['a.read'] }),
        manifest({ id: 'b', route: '/b', permissions: ['b.read'] }),
      ],
      ['a.read'],
    );
    const ids = nav.flatMap((s) => s.items.map((i) => i.id));
    expect(ids).toEqual(['a']);
  });

  it('excludes the dashboard module from sections', () => {
    const nav = buildNavigation([manifest({ id: 'dashboard', route: '/dashboard' })], ['dashboard.read']);
    expect(nav.flatMap((s) => s.items).length).toBe(0);
  });

  it('excludes navDisabled modules even when the permission is held', () => {
    const nav = buildNavigation(
      [
        manifest({ id: 'employees', route: '/users', navDisabled: true, permissions: [] }),
        manifest({ id: 'users', route: '/users', permissions: [] }),
      ],
      ['employees.read'],
    );
    const ids = nav.flatMap((s) => s.items.map((i) => i.id));
    expect(ids).toEqual(['users']);
  });

  it('orders sections by MODULE_CATEGORIES and preserves module metadata in items', () => {
    const nav = buildNavigation(
      [
        manifest({ id: 'customers', name: 'Customers', category: 'Relations', route: '/customers', permissions: ['customers.read'] }),
        manifest({ id: 'products', name: 'Products', category: 'Operations', route: '/products', permissions: ['products.read'] }),
      ],
      ['customers.read', 'products.read'],
    );
    expect(nav.map((s) => s.label)).toEqual(['Relations', 'Operations']);
    const customers = nav[0].items[0];
    expect(customers).toMatchObject({ href: '/customers', permission: 'customers.read', module: 'customers' });
  });
});