import { Injectable, OnApplicationBootstrap } from '@nestjs/common';

import type { KernelService } from './kernel.service';
import { BUILTIN_MODULE_MANIFESTS } from './module-manifests';


@Injectable()
export class KernelBootstrap implements OnApplicationBootstrap {
  constructor(readonly kernel: KernelService) {}

  /** Registers built-in manifests; safe to call more than once. */
  registerBuiltinModules(): void {
    for (const manifest of BUILTIN_MODULE_MANIFESTS) {
      if (!this.kernel.hasModule(manifest.id)) {
        this.kernel.registerModule(manifest);
      }
    }
  }

  onApplicationBootstrap(): void {
    this.registerBuiltinModules();
  }
}