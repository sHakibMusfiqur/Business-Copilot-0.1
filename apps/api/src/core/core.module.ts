import { Global, Module } from '@nestjs/common';

import { KernelService } from './kernel.service';
import { ModuleRegistry } from './module-registry';
import { ServiceRegistry } from './service-registry';

@Global()
@Module({
  providers: [ModuleRegistry, ServiceRegistry, KernelService],
  exports: [KernelService, ModuleRegistry, ServiceRegistry],
})
export class CoreModule {}