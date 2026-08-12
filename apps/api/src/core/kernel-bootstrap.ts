import { Injectable } from '@nestjs/common';

import { KernelService } from './kernel.service';
import { BUILTIN_MODULE_MANIFESTS } from './module-manifests';


/**
 * Registers built-in module manifests into the kernel. Deliberately does NOT
 * implement a Nest lifecycle hook: ordering is controlled solely by the
 * `KernelLifecycle` coordinator so bootstrap is deterministic rather than
 * relying on incidental provider-hook firing order.
 */
@Injectable()
export class KernelBootstrap {
  constructor(readonly kernel: KernelService) {}

  /** Registers built-in manifests; safe to call more than once. */
  registerBuiltinModules(): void {
    for (const manifest of BUILTIN_MODULE_MANIFESTS) {
      if (!this.kernel.hasModule(manifest.id)) {
        this.kernel.registerModule(manifest);
      }
    }
  }
}