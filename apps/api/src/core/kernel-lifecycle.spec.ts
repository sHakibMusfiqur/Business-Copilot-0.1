import { Test } from '@nestjs/testing';

import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { RedisModule } from '../infrastructure/redis/redis.module';
import { RedisService } from '../infrastructure/redis/redis.service';

import { CoreModule } from './core.module';
import { KernelBootstrap } from './kernel-bootstrap';
import { KernelLifecycle } from './kernel-lifecycle';
import { KernelService } from './kernel.service';
import { ModuleRegistry } from './module-registry';
import { ServiceBootstrapper } from './service-bootstrap';
import { ServiceRegistry } from './service-registry';

function makeKernel(): {
  kernel: KernelService;
  lifecycle: KernelLifecycle;
  bootstrap: KernelBootstrap;
  serviceBootstrapper: ServiceBootstrapper;
} {
  const kernel = new KernelService(new ModuleRegistry(), new ServiceRegistry());
  const bootstrap = new KernelBootstrap(kernel);
  const serviceBootstrapper = new ServiceBootstrapper(
    kernel,
    {} as ConfigService,
    {} as RedisService,
  );
  const lifecycle = new KernelLifecycle(kernel, bootstrap, serviceBootstrapper);
  return { kernel, lifecycle, bootstrap, serviceBootstrapper };
}

describe('KernelLifecycle (unit coordinator)', () => {
  it('runs in deterministic order: modules → services → initialize', async () => {
    const { kernel, lifecycle, bootstrap, serviceBootstrapper } = makeKernel();
    const log: string[] = [];
    jest
      .spyOn(bootstrap, 'registerBuiltinModules')
      .mockImplementation(() => void log.push('modules'));
    jest
      .spyOn(serviceBootstrapper, 'registerInfrastructureServices')
      .mockImplementation(() => void log.push('services'));
    kernel.registerService('a', {
      initialize: async () => void log.push('initialize'),
    });

    await lifecycle.onApplicationBootstrap();

    expect(log).toEqual(['modules', 'services', 'initialize']);
  });

  it('registers CRM/Billing and Config/Redis before kernel initialization', async () => {
    const { kernel, lifecycle } = makeKernel();
    let snapshot: {
      crm: boolean;
      billing: boolean;
      config: boolean;
      redis: boolean;
    } | null = null;
    kernel.registerService('a', {
      initialize: async () => {
        snapshot = {
          crm: kernel.hasModule('crm'),
          billing: kernel.hasModule('billing'),
          config: kernel.hasService('config'),
          redis: kernel.hasService('redis'),
        };
      },
    });

    await lifecycle.onApplicationBootstrap();

    expect(snapshot).toEqual({ crm: true, billing: true, config: true, redis: true });
  });

  it('initializes once even if onApplicationBootstrap runs twice', async () => {
    const { kernel, lifecycle } = makeKernel();
    let initCount = 0;
    kernel.registerService('a', {
      initialize: async () => {
        initCount += 1;
      },
    });
    await lifecycle.onApplicationBootstrap();
    await lifecycle.onApplicationBootstrap();
    expect(initCount).toBe(1);
  });

  it('shuts down once even if beforeApplicationShutdown runs twice', async () => {
    const { kernel, lifecycle } = makeKernel();
    let shutdownCount = 0;
    kernel.registerService('a', {
      initialize: async () => {},
      shutdown: async () => {
        shutdownCount += 1;
      },
    });
    await lifecycle.beforeApplicationShutdown();
    await lifecycle.beforeApplicationShutdown();
    expect(shutdownCount).toBe(1);
  });

  it('shuts down in reverse registration order', async () => {
    const { kernel, lifecycle } = makeKernel();
    const log: string[] = [];
    kernel.registerService('a', {
      initialize: async () => log.push('init:a'),
      shutdown: async () => log.push('shutdown:a'),
    });
    kernel.registerService('b', {
      initialize: async () => log.push('init:b'),
      shutdown: async () => log.push('shutdown:b'),
    });
    await lifecycle.onApplicationBootstrap();
    await lifecycle.beforeApplicationShutdown();
    expect(log).toEqual(['init:a', 'init:b', 'shutdown:b', 'shutdown:a']);
  });

  it('propagates lifecycle errors', async () => {
    const { kernel, lifecycle } = makeKernel();
    kernel.registerService('a', {
      initialize: async () => {
        throw new Error('boot failed');
      },
    });
    await expect(lifecycle.onApplicationBootstrap()).rejects.toThrow(
      'boot failed',
    );
  });
});

describe('KernelLifecycle (Nest integration)', () => {
  it('compiles CoreModule and runs the deterministic kernel lifecycle during bootstrap/shutdown', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule, CoreModule],
    }).compile();

    const kernel = moduleRef.get(KernelService);
    const log: string[] = [];
    kernel.registerService('a', {
      initialize: async () => log.push('init:a'),
      shutdown: async () => log.push('shutdown:a'),
    });

    await moduleRef.init();

    // Infra services and manifests registered, then initialized, during bootstrap.
    expect(kernel.hasModule('crm')).toBe(true);
    expect(kernel.hasModule('billing')).toBe(true);
    expect(kernel.hasService('config')).toBe(true);
    expect(kernel.hasService('redis')).toBe(true);
    expect(log).toContain('init:a');

    await moduleRef.close();
    expect(log).toEqual(['init:a', 'shutdown:a']);

    await moduleRef.close();
    await moduleRef.close();
    expect(log).toEqual(['init:a', 'shutdown:a']);
  });
});