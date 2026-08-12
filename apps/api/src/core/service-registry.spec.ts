import { LifecycleAware } from './lifecycle';
import { ModuleRegistry } from './module-registry';
import { KernelService } from './kernel.service';
import {
  ServiceAlreadyRegisteredError,
  ServiceRegistry,
  type ServiceEntry,
} from './service-registry';

/** Records call order for lifecycle assertions. */
function makeTrace(): { log: string[]; svc: Record<string, LifecycleAware> } {
  const log: string[] = [];
  const svc: Record<string, LifecycleAware> = {};
  for (const name of ['a', 'b', 'c']) {
    svc[name] = {
      initialize: async () => {
        log.push(`init:${name}`);
      },
      shutdown: async () => {
        log.push(`shutdown:${name}`);
      },
    };
  }
  return { log, svc };
}

describe('ServiceRegistry', () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    registry = new ServiceRegistry();
  });

  it('registers a service', () => {
    registry.register('mailer', { send: () => {} });
    expect(registry.has('mailer')).toBe(true);
  });

  it('retrieves a registered service', () => {
    const service = { send: () => {} };
    registry.register('mailer', service);
    expect(registry.get('mailer')).toBe(service);
  });

  it('lists all services in registration order', () => {
    registry.register('a', {} as unknown);
    registry.register('b', {} as object);
    expect(registry.list().map((e) => e.name)).toEqual(['a', 'b']);
  });

  it('rejects a duplicate registration with a clear error', () => {
    registry.register('mailer', {});
    expect(() => registry.register('mailer', {})).toThrow(
      ServiceAlreadyRegisteredError,
    );
  });

  it('returns undefined for an unknown service', () => {
    expect(registry.get('missing')).toBeUndefined();
    expect(registry.has('missing')).toBe(false);
  });
});

describe('ServiceRegistry lifecycle', () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    registry = new ServiceRegistry();
  });

  it('initializes in registration order', async () => {
    const { log, svc } = makeTrace();
    registry.register('a', svc.a);
    registry.register('b', svc.b);
    await registry.initialize();
    expect(log).toEqual(['init:a', 'init:b']);
  });

  it('shuts down in reverse registration order', async () => {
    const { log, svc } = makeTrace();
    registry.register('a', svc.a);
    registry.register('b', svc.b);
    registry.register('c', svc.c);
    await registry.initialize();
    await registry.shutdown();
    expect(log).toEqual(['init:a', 'init:b', 'init:c', 'shutdown:c', 'shutdown:b', 'shutdown:a']);
  });

  it('does not run initialize twice', async () => {
    let count = 0;
    registry.register('a', {
      initialize: async () => {
        count += 1;
      },
    });
    await registry.initialize();
    await registry.initialize();
    expect(count).toBe(1);
  });

  it('does not run shutdown twice', async () => {
    let count = 0;
    registry.register('a', {
      initialize: async () => {},
      shutdown: async () => {
        count += 1;
      },
    });
    await registry.initialize();
    await registry.shutdown();
    await registry.shutdown();
    expect(count).toBe(1);
  });

  it('propagates lifecycle errors', async () => {
    registry.register('a', {
      initialize: async () => {
        throw new Error('boot failed');
      },
    });
    await expect(registry.initialize()).rejects.toThrow('boot failed');
  });
});

describe('KernelService service + lifecycle API', () => {
  it('delegates service registration, lookup and lifecycle', async () => {
    const kernel = new KernelService(new ModuleRegistry(), new ServiceRegistry());
    const { svc } = makeTrace();
    kernel.registerService('a', svc.a);
    expect(kernel.hasService('a')).toBe(true);
    expect(kernel.getService<LifecycleAware>('a')).toBe(svc.a);
    expect(
      (kernel.listServices() as ServiceEntry[]).map((e) => e.name),
    ).toEqual(['a']);
    await kernel.initialize();
    await kernel.shutdown();
  });
});