import type { EnvironmentContext, FeatureFlags } from '../environment';
import { RESERVED_ENGINES, RESERVED_ENGINE_IDS } from './metadata';
import type { EngineRegistry } from './registry';
import type { PlatformLifecycle } from './lifecycle';
import { ServiceRegistry } from '../../services/registry';
import type { ServiceDescriptor, ServiceHealth, ServiceStatus } from '../../services/types';
import type { ConfigEngine } from '../../config/engine';
import type { DesignTokenEngine } from '../../design';
import type { FeatureRegistry } from '../../features';
import type { ErrorEngine } from '../../errors';
import type { LoggerEngine } from '../../logger';
import type { IdentityEngine } from '../../identity';
import type {
  EngineHealth,
  EngineKind,
  EngineRecord,
  EngineRegistrationInput,
  EngineStatus,
  PlatformContext,
  PlatformPhase,
  PlatformSession,
  PlatformStatus,
  ReservedEngine,
} from './types';

export interface PlatformKernelOptions {
  registry: EngineRegistry;
  context: PlatformContext;
  lifecycle: PlatformLifecycle;
  /** Optional enterprise service registry; when provided the kernel delegates
   *  service resolution to it and exposes it as `kernel.services`. */
  services?: ServiceRegistry;
}

/** Empty registry used when the kernel is constructed without a service layer. */
function createEmptyServiceRegistry(): ServiceRegistry {
  return new ServiceRegistry();
}

export class PlatformKernel {
  readonly registry: EngineRegistry;
  readonly context: PlatformContext;
  readonly lifecycle: PlatformLifecycle;
  readonly services: ServiceRegistry;

  constructor(options: PlatformKernelOptions) {
    this.registry = options.registry;
    this.context = options.context;
    this.lifecycle = options.lifecycle;
    this.services = options.services ?? createEmptyServiceRegistry();
  }

  // ── Engine registration ───────────────────────────────────────────────────

  /** Registers an engine. Returns false when the id is already registered. */
  registerEngine(input: EngineRegistrationInput): boolean {
    return this.registry.register(input);
  }

  /** Optional engine lookup — returns undefined when absent. */
  getEngine<T extends object>(id: string): T | undefined {
    return this.registry.get<T>(id)?.implementation;
  }

  /** Full engine record (metadata + status + implementation). */
  getRecord<T extends object>(id: string): EngineRecord<T> | undefined {
    return this.registry.get<T>(id);
  }

  /** Required engine resolution — throws when the engine is not registered. */
  engine<T extends object>(id: string): T {
    const implementation = this.getEngine<T>(id);
    if (!implementation) {
      throw new Error(`Platform engine not registered: ${id}`);
    }
    return implementation;
  }

  hasEngine(id: string): boolean {
    return this.registry.has(id);
  }

  listEngines(): EngineRecord<object>[] {
    return this.registry.list();
  }

  enginesByKind(kind: EngineKind): EngineRecord<object>[] {
    return this.registry.byKind(kind);
  }

  setEngineStatus(id: string, status: EngineStatus, health?: EngineHealth): boolean {
    return this.registry.setStatus(id, status, health);
  }

  markReady(id: string): boolean {
    return this.registry.setStatus(id, 'ready', { status: 'ok', checkedAt: new Date().toISOString() });
  }

  markFailed(id: string, message?: string): boolean {
    return this.registry.setStatus(id, 'failed', {
      status: 'degraded',
      message,
      checkedAt: new Date().toISOString(),
    });
  }

  updateHealth(id: string, health: EngineHealth): boolean {
    return this.registry.updateHealth(id, health);
  }

  // ── Application lifecycle ─────────────────────────────────────────────────

  /** Advances the platform to the next lifecycle phase. */
  transition(phase: PlatformPhase): PlatformPhase {
    const next = this.lifecycle.transition(phase);
    this.context.phase = next;
    return next;
  }

  get phase(): PlatformPhase {
    return this.lifecycle.phase;
  }

  isReady(): boolean {
    return this.lifecycle.isReady();
  }

  // ── Global platform state / session ──────────────────────────────────────

  setSession(session: Partial<PlatformSession>): void {
    this.context.session = { ...this.context.session, ...session };
  }

  getSession(): PlatformSession {
    return this.context.session;
  }

  // ── Runtime features ──────────────────────────────────────────────────────

  get features(): FeatureFlags {
    return this.context.environment.features;
  }

  hasFeature(name: keyof FeatureFlags): boolean {
    return this.context.environment.features[name] === true;
  }

  // ── Reserved future engines ───────────────────────────────────────────────

  reservedEngines(): readonly ReservedEngine[] {
    return RESERVED_ENGINES;
  }

  isReserved(id: string): boolean {
    return RESERVED_ENGINE_IDS.includes(id);
  }

  // ── Platform status / health ──────────────────────────────────────────────

  status(): PlatformStatus {
    const engines = this.registry.list();
    return {
      phase: this.lifecycle.phase,
      engineCount: engines.length,
      readyEngines: engines.filter((engine) => engine.status === 'ready').length,
      failedEngines: engines.filter((engine) => engine.status === 'failed').length,
      healthy: this.lifecycle.isReady() && engines.every((engine) => engine.status !== 'failed'),
    };
  }

  /** Convenience: the resolved environment for this platform boot. */
  environment(): EnvironmentContext {
    return this.context.environment;
  }

  // ── Service resolution (delegates to the service registry) ─────────────────

  /** Resolves a platform service, throwing when it cannot be provided. */
  service<T extends object>(id: string): T {
    return this.services.resolve<T>(id);
  }

  /** Looks up a platform service; returns undefined when unavailable. */
  serviceIf<T extends object>(id: string): T | undefined {
    return this.services.get<T>(id);
  }

  hasService(id: string): boolean {
    return this.services.has(id);
  }

  listServices(): ServiceDescriptor[] {
    return this.services.list();
  }

  serviceStatus(id: string): ServiceStatus | undefined {
    return this.services.status(id);
  }

  serviceHealth(id: string): ServiceHealth | undefined {
    return this.services.health(id);
  }

  isServiceReserved(id: string): boolean {
    return this.services.isReserved(id);
  }

  // ── Configuration (delegates to the registered config service) ─────────────

  /** Resolves the Configuration Engine; throws when not registered. */
  config(): ConfigEngine | undefined {
    return this.services.get<ConfigEngine>('config');
  }

  // ── Design tokens (delegates to the registered design token service) ──────

  /** Resolves the Design Token Engine; throws when not registered. */
  design(): DesignTokenEngine | undefined {
    return this.services.get<DesignTokenEngine>('design');
  }

  // ── Features (delegates to the registered feature registry) ────────────────

  /** Resolves the Feature Registry; throws when not registered. */
  featureRegistry(): FeatureRegistry | undefined {
    return this.services.get<FeatureRegistry>('features');
  }

  // ── Errors (delegates to the registered error engine) ─────────────────────

  /** Resolves the Error Engine; throws when not registered. */
  errors(): ErrorEngine | undefined {
    return this.services.get<ErrorEngine>('errors');
  }

  // ── Logger (delegates to the registered logger engine) ────────────────────

  /** Resolves the Logger Engine; throws when not registered. */
  logger(): LoggerEngine | undefined {
    return this.services.get<LoggerEngine>('logger');
  }

  // ── Identity (delegates to the registered identity engine) ────────────────

  /** Resolves the Identity Engine; throws when not registered. */
  identity(): IdentityEngine | undefined {
    return this.services.get<IdentityEngine>('identity');
  }
}
