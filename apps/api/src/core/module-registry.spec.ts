import type { ModuleManifest } from '@bc/core';

import { ModuleAlreadyRegisteredError, ModuleRegistry } from './module-registry';

function makeModule(id: string, overrides: Partial<ModuleManifest> = {}): ModuleManifest {
  return {
    id,
    name: id,
    category: 'Workspace',
    route: `/${id}`,
    permissions: [],
    capabilities: [],
    status: 'stable',
    ...overrides,
  };
}

describe('ModuleRegistry', () => {
  let registry: ModuleRegistry;

  beforeEach(() => {
    registry = new ModuleRegistry();
  });

  it('registers a module', () => {
    registry.register(makeModule('catalog'));
    expect(registry.has('catalog')).toBe(true);
  });

  it('retrieves a registered module', () => {
    const manifest = makeModule('catalog');
    registry.register(manifest);
    expect(registry.get('catalog')).toEqual(manifest);
  });

  it('lists all registered modules in registration order', () => {
    registry.register(makeModule('catalog'));
    registry.register(makeModule('inventory'));
    expect(registry.list().map((m) => m.id)).toEqual(['catalog', 'inventory']);
  });

  it('rejects a duplicate registration with a clear error', () => {
    registry.register(makeModule('catalog'));
    expect(() => registry.register(makeModule('catalog'))).toThrow(ModuleAlreadyRegisteredError);
  });

  it('handles an unknown module lookup safely', () => {
    expect(registry.get('missing')).toBeUndefined();
    expect(registry.has('missing')).toBe(false);
  });
});