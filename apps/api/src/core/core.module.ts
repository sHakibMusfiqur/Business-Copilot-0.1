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
import { WorkspaceContextAdapter } from './workspace-context.adapter';
import { WorkspaceResolver } from './workspace-resolver';
import { WorkspaceAccessEnforcer } from './workspace-access-enforcer';
import { WorkspaceAccessPolicy } from './workspace-access-policy';
import { WorkspacePermissionMapper } from './workspace-permission.mapper';
import { WorkspaceRuntimeContext } from './workspace-runtime-context';
import { WorkspaceRuntimeService } from './workspace-runtime.service';


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
    WorkspaceContextAdapter,
    WorkspaceRuntimeService,
    WorkspaceRuntimeContext,
    WorkspaceAccessPolicy,
    WorkspaceAccessEnforcer,
    WorkspacePermissionMapper,
  ],
  exports: [
    KernelService,
    ModuleRegistry,
    ServiceRegistry,
    WorkspaceResolver,
    WorkspaceRuntimeService,
    WorkspaceRuntimeContext,
    WorkspaceAccessPolicy,
    WorkspaceAccessEnforcer,
    WorkspacePermissionMapper,
  ],
})
export class CoreModule {}