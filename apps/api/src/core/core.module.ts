import { Global, Module, type Provider } from '@nestjs/common';

import { CapabilityResolver } from './capability-resolver';
import { EntitlementResolver } from './entitlement-resolver';
import { KernelBootstrap } from './kernel-bootstrap';
import { KernelLifecycle } from './kernel-lifecycle';
import { KernelService } from './kernel.service';
import { ModuleRegistry } from './module-registry';
import { ModuleResolver } from './module-resolver';
import { ServiceBootstrapper } from './service-bootstrap';
import { ServiceRegistry } from './service-registry';
import { WorkspaceResolver } from './workspace-resolver';

/**
 * Core-level provider wiring for the pure Business OS resolution pipeline.
 *
 * `ModuleResolver` is intentionally NOT decorated as an injectable class: it
 * requires the set of available module manifests, whose membership is only
 * finalized once the kernel `ModuleRegistry` has been populated during
 * bootstrap. Because Nest constructs providers before `onApplicationBootstrap`
 * registers the built-in CRM/Billing manifests, the factory binds the resolver
 * to a live `ManifestSource` over the registry instead of a static snapshot.
 * This keeps the resolver pipeline pure (no request/user/DB state) while
 * always reflecting the current manifests.
 *
 * The resulting dependency graph is acyclic and layered:
 *
 *   CoreModule
 *      ↓
 *   ModuleRegistry
 *      ↓
 *   ModuleResolver        (ManifestSource over live ModuleRegistry)
 *      ↓
 *   CapabilityResolver
 *      ↓
 *   EntitlementResolver
 *      ↓
 *   WorkspaceResolver     (injects EntitlementResolver + CapabilityResolver)
 *
 * Only `WorkspaceResolver` is exported — it is the public entry point of the
 * resolution pipeline. The others remain module-internal providers.
 */
const MODULE_RESOLVER_PROVIDER: Provider = {
  provide: ModuleResolver,
  inject: [ModuleRegistry],
  useFactory: (registry: ModuleRegistry) =>
    new ModuleResolver({ list: () => registry.list() }),
};

@Global()
@Module({
  providers: [
    ModuleRegistry,
    ServiceRegistry,
    KernelService,
    KernelBootstrap,
    KernelLifecycle,
    ServiceBootstrapper,
    MODULE_RESOLVER_PROVIDER,
    CapabilityResolver,
    EntitlementResolver,
    WorkspaceResolver,
  ],
  exports: [KernelService, ModuleRegistry, ServiceRegistry, WorkspaceResolver],
})
export class CoreModule {}