import {
  BeforeApplicationShutdown,
  Injectable,
  OnApplicationBootstrap,
} from '@nestjs/common';

import { KernelService } from './kernel.service';

import { KernelBootstrap } from './kernel-bootstrap';
import { ServiceBootstrapper } from './service-bootstrap';

/**
 * Single deterministic coordinator for the kernel boot/shutdown sequence.
 *
 * Rather than letting `KernelBootstrap`, `ServiceBootstrapper` and this adapter
 * each run an `OnApplicationBootstrap` hook in Nest's incidental order, this
 * adapter is the ONLY startup driver and calls the steps explicitly:
 *
 *  1. `KernelBootstrap.registerBuiltinModules()`     -> module manifests
 *  2. `ServiceBootstrapper.registerInfrastructureServices()` -> infra services
 *  3. `KernelService.initialize()`                   -> initialize (exactly once)
 *
 * Every step is idempotent, so repeated `onApplicationBootstrap` calls cannot
 * duplicate registrations or replay initialization. `beforeApplicationShutdown`
 * runs `KernelService.shutdown()` exactly once and leaves other Nest module
 * destroy hooks (e.g. Redis `onModuleDestroy`) untouched. Lifecycle errors from
 * the underlying registries propagate up to Nest instead of being swallowed.
 */
@Injectable()
export class KernelLifecycle
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  constructor(
    readonly kernel: KernelService,
    private readonly bootstrap: KernelBootstrap,
    private readonly serviceBootstrapper: ServiceBootstrapper,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.bootstrap.registerBuiltinModules();
    this.serviceBootstrapper.registerInfrastructureServices();
    await this.kernel.initialize();
  }

  async beforeApplicationShutdown(): Promise<void> {
    await this.kernel.shutdown();
  }
}