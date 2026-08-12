import type { ModuleManifest } from '@bc/core';

import { KernelService } from './kernel.service';
import { ModuleRegistry } from './module-registry';

function makeModule(id: string): ModuleManifest {
  return {
    id,
    name: id,
    category: 'Finance',
    route: `/${id}`,
    permissions: [],
    capabilities: [],
    status: 'beta',
  };
}

describe('KernelService', () => {
  let kernel: KernelService;

  beforeEach(() => {
    kernel = new KernelService(new ModuleRegistry());
  });

  it('registers and exposes a module', () => {
    kernel.registerModule(makeModule('billing'));
    expect(kernel.hasModule('billing')).toBe(true);
  });

  it('retrieves a module through the registry', () => {
    const manifest = makeModule('billing');
    kernel.registerModule(manifest);
    expect(kernel.getModule('billing')).toEqual(manifest);
  });

  it('lists registered modules', () => {
    kernel.registerModule(makeModule('billing'));
    kernel.registerModule(makeModule('audit'));
    expect(kernel.listModules().map((m) => m.id)).toEqual(['billing', 'audit']);
  });

  it('delegates duplicate registration rejection to the registry', () => {
    kernel.registerModule(makeModule('billing'));
    expect(() => kernel.registerModule(makeModule('billing'))).toThrow(
      'already registered',
    );
  });

  it('returns undefined for an unknown module', () => {
    expect(kernel.getModule('nope')).toBeUndefined();
    expect(kernel.hasModule('nope')).toBe(false);
  });
});