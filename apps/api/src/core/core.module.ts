import { Global, Module } from '@nestjs/common';

import { KernelBootstrap } from './kernel-bootstrap';
import { KernelLifecycle } from './kernel-lifecycle';
import { KernelService } from './kernel.service';
import { ModuleRegistry } from './module-registry';
import { ServiceBootstrapper } from './service-bootstrap';
import { ServiceRegistry } from './service-registry';

@Global()
@Module({
  providers: [
    ModuleRegistry,
    ServiceRegistry,
    KernelService,
    KernelBootstrap,
    KernelLifecycle,
    ServiceBootstrapper,
  ],
  exports: [KernelService, ModuleRegistry, ServiceRegistry],
})
export class CoreModule {}