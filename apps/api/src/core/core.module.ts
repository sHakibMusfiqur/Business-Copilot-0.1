import { Global, Module } from '@nestjs/common';

import { KernelService } from './kernel.service';
import { ModuleRegistry } from './module-registry';

@Global()
@Module({
  providers: [ModuleRegistry, KernelService],
  exports: [KernelService, ModuleRegistry],
})
export class CoreModule {}