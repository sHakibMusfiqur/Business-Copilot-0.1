import { KernelBootstrap } from './kernel-bootstrap';
import { KernelService } from './kernel.service';
import { ModuleAlreadyRegisteredError, ModuleRegistry } from './module-registry';
import { BUILTIN_MODULE_MANIFESTS } from './module-manifests';
import { ServiceRegistry } from './service-registry';

function makeKernel(): { kernel: KernelService; bootstrap: KernelBootstrap } {
  const kernel = new KernelService(new ModuleRegistry(), new ServiceRegistry());
  const bootstrap = new KernelBootstrap(kernel);
  return { kernel, bootstrap };
}

describe('KernelBootstrap', () => {
  it('registers the CRM manifest', () => {
    const { kernel, bootstrap } = makeKernel();
    bootstrap.registerBuiltinModules();
    expect(kernel.hasModule('crm')).toBe(true);
    expect(kernel.getModule('crm')?.capabilities).toEqual(['crm']);
  });

  it('registers the Billing manifest', () => {
    const { kernel, bootstrap } = makeKernel();
    bootstrap.registerBuiltinModules();
    expect(kernel.hasModule('billing')).toBe(true);
    expect(kernel.getModule('billing')?.capabilities).toEqual([
      'administration',
      'platform',
    ]);
  });

  it('exposes both manifests through KernelService', () => {
    const { kernel, bootstrap } = makeKernel();
    bootstrap.registerBuiltinModules();
    expect(kernel.getModule('crm')?.id).toBe('crm');
    expect(kernel.getModule('billing')?.id).toBe('billing');
    expect(kernel.listModules().map((m) => m.id)).toEqual(['crm', 'billing']);
  });

  it('does not create duplicates on repeated bootstrap', () => {
    const { kernel, bootstrap } = makeKernel();
    bootstrap.registerBuiltinModules();
    bootstrap.registerBuiltinModules();
    bootstrap.onApplicationBootstrap();
    expect(kernel.listModules()).toHaveLength(BUILTIN_MODULE_MANIFESTS.length);
    expect(kernel.listModules().filter((m) => m.id === 'crm')).toHaveLength(1);
    expect(kernel.listModules().filter((m) => m.id === 'billing')).toHaveLength(1);
  });

  it('keeps existing registry behavior unchanged (manual duplicates still throw)', () => {
    const { kernel, bootstrap } = makeKernel();
    bootstrap.registerBuiltinModules();
    expect(() => kernel.registerModule({ id: 'crm' } as never)).toThrow(
      ModuleAlreadyRegisteredError,
    );
  });
});