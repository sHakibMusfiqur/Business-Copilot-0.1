import { Test } from '@nestjs/testing';

import { ConfigModule } from '../config/config.module';
import { RedisModule } from '../infrastructure/redis/redis.module';

import { CapabilityResolver } from './capability-resolver';
import { CoreModule } from './core.module';
import { EntitlementResolver } from './entitlement-resolver';
import { KernelService } from './kernel.service';
import { ModuleRegistry } from './module-registry';
import { ModuleResolver } from './module-resolver';
import { WorkspaceResolver } from './workspace-resolver';

describe('Core resolver pipeline (Nest DI)', () => {
  it('CoreModule compiles successfully', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule, CoreModule],
    }).compile();
    expect(moduleRef.get(KernelService)).toBeInstanceOf(KernelService);
    await moduleRef.close();
  });

  it('resolves ModuleResolver from Nest DI, built from the kernel ModuleRegistry manifests', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule, CoreModule],
    }).compile();

    await moduleRef.init();
    const resolver = moduleRef.get(ModuleResolver);
    const kernel = moduleRef.get(KernelService);

    expect(resolver).toBeInstanceOf(ModuleResolver);
    // Constructed from the live ModuleRegistry manifests registered at bootstrap.
    const manifestIds = resolver
      .resolve({
        capabilities: ['crm', 'administration', 'platform'],
        permissions: ['crm.read', 'billing.read'],
      })
      .map((m) => m.id);
    expect(kernel.hasModule('crm')).toBe(true);
    expect(kernel.hasModule('billing')).toBe(true);
    expect(manifestIds).toContain('crm');
    expect(manifestIds).toContain('billing');

    await moduleRef.close();
  });

  it('resolves CapabilityResolver from Nest DI', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule, CoreModule],
    }).compile();

    expect(moduleRef.get(CapabilityResolver)).toBeInstanceOf(
      CapabilityResolver,
    );

    await moduleRef.close();
  });

  it('resolves EntitlementResolver from Nest DI', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule, CoreModule],
    }).compile();

    expect(moduleRef.get(EntitlementResolver)).toBeInstanceOf(
      EntitlementResolver,
    );

    await moduleRef.close();
  });

  it('resolves WorkspaceResolver from Nest DI', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule, CoreModule],
    }).compile();

    expect(moduleRef.get(WorkspaceResolver)).toBeInstanceOf(WorkspaceResolver);

    await moduleRef.close();
  });

  it('injects the expected resolver dependencies into WorkspaceResolver', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule, CoreModule],
    }).compile();

    const workspace = moduleRef.get(WorkspaceResolver);
    const entitlement = moduleRef.get(EntitlementResolver);
    const capability = moduleRef.get(CapabilityResolver);

    expect(workspace.entitlements).toBe(entitlement);
    expect(workspace.capabilities).toBe(capability);

    await moduleRef.close();
  });

  it('registers a single instance per provider (no duplicate providers)', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule, CoreModule],
    }).compile();

    expect(moduleRef.get(ModuleResolver)).toBe(moduleRef.get(ModuleResolver));
    expect(moduleRef.get(CapabilityResolver)).toBe(
      moduleRef.get(CapabilityResolver),
    );
    expect(moduleRef.get(EntitlementResolver)).toBe(
      moduleRef.get(EntitlementResolver),
    );
    expect(moduleRef.get(WorkspaceResolver)).toBe(
      moduleRef.get(WorkspaceResolver),
    );

    await moduleRef.close();
  });

  it('has no circular dependency (compilation and bootstrap succeed)', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule, CoreModule],
    }).compile();

    // A circular DI graph would throw during compilation/init.
    await moduleRef.init();
    await moduleRef.close();
  });

  it('keeps CRM/Billing manifests registered after bootstrap', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule, CoreModule],
    }).compile();

    const kernel = moduleRef.get(KernelService);
    await moduleRef.init();
    expect(kernel.hasModule('crm')).toBe(true);
    expect(kernel.hasModule('billing')).toBe(true);

    await moduleRef.close();
  });

  it('keeps Config/Redis service registration working', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule, CoreModule],
    }).compile();

    const kernel = moduleRef.get(KernelService);
    await moduleRef.init();
    expect(kernel.hasService('config')).toBe(true);
    expect(kernel.hasService('redis')).toBe(true);

    await moduleRef.close();
  });

  it('keeps kernel initialize/shutdown working', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule, CoreModule],
    }).compile();

    const kernel = moduleRef.get(KernelService);
    const log: string[] = [];
    kernel.registerService('probe', {
      initialize: async () => void log.push('init'),
      shutdown: async () => void log.push('shutdown'),
    });

    await moduleRef.init();
    expect(log).toEqual(['init']);
    await moduleRef.close();
    expect(log).toEqual(['init', 'shutdown']);

    await moduleRef.close();
    expect(log).toEqual(['init', 'shutdown']);
  });

  it('resolves a sample workspace through the DI-provided pipeline', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, RedisModule, CoreModule],
    }).compile();

    await moduleRef.init();

    const workspace = moduleRef.get(WorkspaceResolver);
    const registry = moduleRef.get(ModuleRegistry);

    const resolved = workspace.resolve(
      {
        tenantId: 'tenant-1',
        organizationName: 'Acme',
        role: 'owner',
        industry: 'retail',
        permissions: ['crm.read', 'billing.read'],
        modules: ['crm', 'billing'],
        aiEnabled: true,
      },
      registry.list(),
    );

    expect(workspace).toBe(moduleRef.get(WorkspaceResolver));
    expect(resolved.tenant.tenantId).toBe('tenant-1');
    expect(resolved.modules.map((m) => m.id)).toEqual(['billing', 'crm']);
    expect(resolved.capabilities.can('crm')).toBe(true);
    expect(resolved.capabilities.can('administration')).toBe(true);
    expect(resolved.entitlement.source).toBe('default');

    await moduleRef.close();
  });
});