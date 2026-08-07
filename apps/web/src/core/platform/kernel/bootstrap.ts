import type { EnvironmentContext } from '../environment';
import {
  PLATFORM_INDUSTRY_KEYS,
  PLATFORM_ROLE_KEYS,
  resolveEnvironment,
} from '../environment';
import { PLATFORM_METADATA } from './metadata';
import { createPlatformContext } from './runtime';
import { EngineRegistry } from './registry';
import { PlatformLifecycle } from './lifecycle';
import { PlatformKernel } from './kernel';
import type { EngineRegistrationInput, PlatformSession } from './types';
import { ServiceRegistry } from '../../services/registry';
import type { ServiceDefinition } from '../../services/types';
import { ConfigEngine } from '../../config/engine';
import { DesignTokenEngine, ALL_TOKENS } from '../../design';
import { FeatureRegistry } from '../../features';
import { ErrorEngine } from '../../errors';
import { LoggerEngine } from '../../logger';
import type { LogLevel } from '../../logger';
import { IdentityEngine } from '../../identity';
import { EventBus } from '../../events/event-bus';
import { CommandBus } from '../../commands/command-bus';
import { QueryBus } from '../../queries/query-bus';
import { ModuleEngine } from '../../modules/engine';
import { PluginRegistry } from '../../plugins/registry';
import { createExtensionSDK } from '../../sdk/extension-sdk';
import { createWorkflowEngine } from '../../workflow/workflow-engine';
import { createAutomationEngine } from '../../automation/automation-engine';

import { moduleRegistry } from '@/core/modules/registry';
import { createCapabilityEngine } from '@/core/capabilities/capabilities-engine';
import { createPermissionEngine } from '@/core/permissions/permission-engine';
import { createEntitlementEngine } from '@/core/entitlements/entitlement-engine';
import { buildNavigation } from '@/core/navigation/navigation-engine';
import { layoutEngine } from '@/core/layout/layout-engine';
import { themeEngine } from '@/core/theme/theme-engine';
import { workspaceEngine } from '@/core/workspace/workspace-engine';
import { resolveWorkspace } from '@/core/manifest/manifest-engine';

export interface BootstrapOptions {
  session?: Partial<PlatformSession>;
  environment?: EnvironmentContext;
}

function coreEngines(): EngineRegistrationInput[] {
  const version = PLATFORM_METADATA.version;
  return [
    {
      id: 'platform',
      name: 'Platform Engine',
      description: 'Environment detection and runtime context resolution.',
      version,
      kind: 'core',
      implementation: { resolveEnvironment, PLATFORM_ROLE_KEYS, PLATFORM_INDUSTRY_KEYS },
    },
    {
      id: 'modules',
      name: 'Module Registry',
      description: 'Declarative module registry — single source of truth for modules.',
      version,
      kind: 'core',
      implementation: moduleRegistry,
    },
    {
      id: 'capabilities',
      name: 'Capability Engine',
      description: 'Resolves granted capabilities from enabled module manifests.',
      version,
      kind: 'core',
      dependencies: ['modules'],
      implementation: createCapabilityEngine(),
    },
    {
      id: 'permissions',
      name: 'Permission Engine',
      description: 'Resolves role and policy context over the raw permission set.',
      version,
      kind: 'service',
      implementation: createPermissionEngine,
    },
    {
      id: 'entitlements',
      name: 'Entitlement Engine',
      description: 'Resolves plan, feature, module and usage-limit entitlements.',
      version,
      kind: 'core',
      implementation: createEntitlementEngine(),
    },
    {
      id: 'navigation',
      name: 'Navigation Engine',
      description: 'Derives sidebar navigation from the module registry.',
      version,
      kind: 'service',
      dependencies: ['modules'],
      implementation: buildNavigation,
    },
    {
      id: 'layout',
      name: 'Layout Engine',
      description: 'Declarative shell composition (regions, grid, breakpoints).',
      version,
      kind: 'core',
      implementation: layoutEngine,
    },
    {
      id: 'theme',
      name: 'Theme Engine',
      description: 'Design tokens and widget style helpers.',
      version,
      kind: 'core',
      implementation: themeEngine,
    },
    {
      id: 'manifest',
      name: 'Manifest Engine',
      description: 'Composes registry, capabilities, permissions and entitlements.',
      version,
      kind: 'service',
      dependencies: ['platform', 'modules', 'capabilities', 'permissions', 'entitlements', 'navigation', 'layout', 'theme'],
      implementation: resolveWorkspace,
    },
    {
      id: 'workspace',
      name: 'Workspace Engine',
      description: 'Top-level workspace facade — manifest resolution, widget data, React context.',
      version,
      kind: 'workspace',
      dependencies: ['platform', 'modules', 'capabilities', 'permissions', 'entitlements', 'navigation', 'layout', 'theme', 'manifest'],
      implementation: workspaceEngine,
    },
    {
      id: 'workflow',
      name: 'Workflow Engine',
      description: 'Declarative, trigger-driven business workflows over the event/command/query buses.',
      version,
      kind: 'workflow',
      implementation: { createWorkflowEngine },
    },
    {
      id: 'automation',
      name: 'Automation Engine',
      description: 'Rule-based automation reacting to events and schedules.',
      version,
      kind: 'automation',
      implementation: { createAutomationEngine },
    },
  ];
}

function coreServices(environment: EnvironmentContext): ServiceDefinition<object>[] {
  const version = PLATFORM_METADATA.version;
  const config = new ConfigEngine();
  // Seed environment mode from the resolved environment so config reflects runtime.
  config.set('environment.mode', environment.runtime.env, 'environment');
  const design = new DesignTokenEngine(ALL_TOKENS);
  // Config is the source of truth for any token that declares a configKey.
  design.syncFromConfig((key) => config.getIf(key));
  const features = new FeatureRegistry();
  const errors = new ErrorEngine();
  const logger = new LoggerEngine({}, (key) => (key === 'logging.level' ? config.getIf(key) as LogLevel : undefined));
  const identity = new IdentityEngine();
  // Phase 2: enterprise messaging backbone + extension runtime.
  const eventBus = new EventBus();
  const commandBus = new CommandBus();
  const queryBus = new QueryBus();
  const moduleEngine = new ModuleEngine();
  // Phase 4: workflow + automation engines over the messaging backbone.
  const workflowEngine = createWorkflowEngine({
    buses: {
      command: (command) => commandBus.execute(command),
      query: (query) => queryBus.execute(query),
      event: (event) => eventBus.publish(event.type, event.payload),
      subscribe: (event, handler) =>
        eventBus.subscribe(event as never, handler as never),
    },
  });
  const automationEngine = createAutomationEngine({
    buses: {
      command: (command) => commandBus.execute(command),
      event: (event) => eventBus.publish(event.type, event.payload),
      runWorkflow: (workflowId, payload) => workflowEngine.run(workflowId, payload),
      subscribe: (event, handler) =>
        eventBus.subscribe(event as never, handler as never),
    },
    logger: logger.logger('automation', { category: 'automation' }),
  });
  return [
    { id: 'environment', name: 'Environment Context', category: 'platform', version, value: environment },
    { id: 'modules', name: 'Module Registry Service', category: 'core', version, value: moduleRegistry },
    { id: 'module-engine', name: 'Module Engine Service', category: 'core', version, value: moduleEngine },
    { id: 'events', name: 'Event Bus Service', category: 'core', version, value: eventBus },
    { id: 'commands', name: 'Command Bus Service', category: 'core', version, value: commandBus },
    { id: 'queries', name: 'Query Bus Service', category: 'core', version, value: queryBus },
    { id: 'capabilities', name: 'Capability Service', category: 'core', version, value: createCapabilityEngine() },
    { id: 'permissions', name: 'Permission Service', category: 'core', version, value: createPermissionEngine },
    { id: 'entitlements', name: 'Entitlement Service', category: 'core', version, value: createEntitlementEngine() },
    { id: 'navigation', name: 'Navigation Service', category: 'core', version, value: buildNavigation },
    { id: 'layout', name: 'Layout Service', category: 'core', version, value: layoutEngine },
    { id: 'theme', name: 'Theme Service', category: 'core', version, value: themeEngine },
    { id: 'manifest', name: 'Manifest Service', category: 'core', version, value: resolveWorkspace },
    { id: 'workspace', name: 'Workspace Service', category: 'application', version, value: workspaceEngine },
    { id: 'workflow', name: 'Workflow Engine Service', category: 'core', version, value: workflowEngine, dependencies: ['events', 'commands', 'queries'] },
    { id: 'automation', name: 'Automation Engine Service', category: 'core', version, value: automationEngine, dependencies: ['events', 'commands', 'workflow'] },
    { id: 'config', name: 'Configuration Service', category: 'core', version, value: config },
    { id: 'design', name: 'Design Token Service', category: 'core', version, value: design },
    { id: 'features', name: 'Feature Registry Service', category: 'core', version, value: features },
    { id: 'errors', name: 'Error Engine Service', category: 'platform', version, value: errors },
    { id: 'logger', name: 'Logger Engine Service', category: 'platform', version, value: logger },
    { id: 'identity', name: 'Identity Engine Service', category: 'platform', version, value: identity },
    {
      id: 'plugins',
      name: 'Plugin Registry Service',
      category: 'platform',
      version,
      value: new PluginRegistry({
        eventBus: {
          subscribe: (event, handler) => eventBus.subscribe(event, handler),
          publish: (event, payload) => eventBus.publish(event, payload),
        },
        commands: {
          register: (type, handler) => commandBus.register({ type, handler }),
          execute: (command) => commandBus.execute(command),
        },
        queries: {
          register: (type, handler) => queryBus.register({ type, handler }),
          execute: (query) => queryBus.execute(query),
        },
      }),
    },
    {
      id: 'extension-sdk',
      name: 'Extension SDK Service',
      category: 'platform',
      version,
      value: createExtensionSDK({
        events: {
          on: (event: string, handler: unknown) => eventBus.subscribe(event, handler as never),
          onAny: (handler) => eventBus.onAny(handler),
          once: (event: string, handler: unknown) => eventBus.once(event, handler as never),
          publish: (event: string, payload: unknown) => eventBus.publish(event, payload),
          use: (middleware) => { eventBus.use(middleware); },
          listenerCount: () => eventBus.listenerCount(),
        },
        commands: {
          register: (definition) => commandBus.register(definition),
          validate: (type, validator) => { commandBus.validate(type, validator); },
          use: (middleware) => { commandBus.use(middleware); },
          execute: (command) => commandBus.execute(command),
          size: () => commandBus.snapshot().commandCount,
        },
        queries: {
          register: (definition) => queryBus.register(definition),
          execute: (query, options) => queryBus.execute(query, options),
          invalidate: (query) => queryBus.invalidate(query),
          clearType: (type) => { queryBus.clearType(type); },
          clearCache: () => { queryBus.clearCache(); },
          size: () => queryBus.snapshot().queryCount,
        },
        controllers: {
          bind: (moduleId, factory) => moduleEngine.controllers.bind(moduleId, factory),
          size: () => moduleEngine.controllers.ids().length,
        },
      }),
    },
  ];
}


export function bootstrapPlatform(options: BootstrapOptions = {}): PlatformKernel {
  const context = createPlatformContext(options.environment);
  const registry = new EngineRegistry();
  const services = new ServiceRegistry();
  const lifecycle = new PlatformLifecycle();
  const kernel = new PlatformKernel({ registry, context, lifecycle, services });

  kernel.transition('booting');

  const engines = coreEngines();
  for (const engine of engines) {
    kernel.registerEngine(engine);
  }

  for (const service of coreServices(context.environment)) {
    services.register(service);
  }

  // Dependency validation — an engine whose dependencies are missing fails.
  for (const record of kernel.listEngines()) {
    const missing = (record.dependencies ?? []).filter((dep) => !kernel.hasEngine(dep));
    if (missing.length > 0) {
      kernel.markFailed(record.id, `Missing dependencies: ${missing.join(', ')}`);
    } else {
      kernel.markReady(record.id);
    }
  }

  if (options.session) {
    kernel.setSession(options.session);
  }

  kernel.transition('ready');
  return kernel;
}

/** Default kernel-wide platform instance, booted once at module load. */
export const platformKernel: PlatformKernel = bootstrapPlatform();
