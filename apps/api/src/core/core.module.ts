import { Global, Module } from '@nestjs/common';

import { KernelBootstrap } from './kernel-bootstrap';
import { KernelService } from './kernel.service';
import { ModuleRegistry } from './module-registry';
import { ServiceRegistry } from './service-registry';

@Global()
@Module({
  providers: [
    ModuleRegistry,
    ServiceRegistry,
    KernelService,
    KernelBootstrap,
  ],
  exports: [KernelService, ModuleRegistry, ServiceRegistry],
})
export class CoreModule {}