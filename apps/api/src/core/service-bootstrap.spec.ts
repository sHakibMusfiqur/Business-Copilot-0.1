import { Test } from '@nestjs/testing';

import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { RedisModule } from '../infrastructure/redis/redis.module';
import { RedisService } from '../infrastructure/redis/redis.service';

import { CoreModule } from './core.module';
import { ServiceBootstrapper } from './service-bootstrap';
import { KernelService } from './kernel.service';

describe('ServiceBootstrapper (Nest DI registration)', () => {
  it('resolves ConfigService and RedisService through Nest dependency injection', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule, CoreModule],
    }).compile();

    const config = moduleRef.get(ConfigService);
    const redis = moduleRef.get(RedisService);

    expect(config).toBeInstanceOf(ConfigService);
    expect(redis).toBeInstanceOf(RedisService);

    await moduleRef.close();
  });

  it('registers config and redis services into the ServiceRegistry via KernelService exactly once', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule, CoreModule],
    }).compile();

    const kernel = moduleRef.get(KernelService);
    const bootstrapper = moduleRef.get(ServiceBootstrapper);

    bootstrapper.registerInfrastructureServices();
    bootstrapper.registerInfrastructureServices();

    expect(kernel.hasService('config')).toBe(true);
    expect(kernel.hasService('redis')).toBe(true);
    // Registered exactly once regardless of repeated bootstrap.
    expect(kernel.listServices().filter((s) => s.name === 'config')).toHaveLength(1);
    expect(kernel.listServices().filter((s) => s.name === 'redis')).toHaveLength(1);

    await moduleRef.close();
  });

  it('lets KernelService retrieve the registered services', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule, CoreModule],
    }).compile();

    const kernel = moduleRef.get(KernelService);
    const bootstrapper = moduleRef.get(ServiceBootstrapper);

    bootstrapper.registerInfrastructureServices();
    await moduleRef.init();

    expect(kernel.getService<ConfigService>('config')).toBeInstanceOf(ConfigService);
    expect(kernel.getService<RedisService>('redis')).toBeInstanceOf(RedisService);

    await moduleRef.close();
  });

  it('keeps existing CoreModule bootstrap registering CRM/Billing manifests', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule, CoreModule],
    }).compile();

    const kernel = moduleRef.get(KernelService);
    await moduleRef.init();

    expect(kernel.hasModule('crm')).toBe(true);
    expect(kernel.hasModule('billing')).toBe(true);

    await moduleRef.close();
  });

  it('initializes and shuts down the application lifecycle without errors', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule, CoreModule],
    }).compile();

    const kernel = moduleRef.get(KernelService);
    await moduleRef.init();
    expect(kernel.hasService('config')).toBe(true);
    expect(kernel.hasService('redis')).toBe(true);
    expect(kernel.hasModule('crm')).toBe(true);
    expect(kernel.hasModule('billing')).toBe(true);

    await expect(moduleRef.close()).resolves.toBeUndefined();
  });
});