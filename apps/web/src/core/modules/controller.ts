import type { ModuleController, ModuleControllerFactory, ModuleRuntimeContext } from './types';

export class ModuleControllerRegistry {
  private readonly factories = new Map<string, ModuleControllerFactory>();
  private readonly instances = new Map<string, ModuleController>();

  /** Bind a module to a lazy controller factory. Returns false if already bound. */
  bind(moduleId: string, factory: ModuleControllerFactory): boolean {
    if (this.factories.has(moduleId)) return false;
    this.factories.set(moduleId, factory);
    return true;
  }

  has(moduleId: string): boolean {
    return this.factories.has(moduleId);
  }

  /** Remove a module binding (and any cached instance). */
  unbind(moduleId: string): boolean {
    return this.factories.delete(moduleId) || this.instances.delete(moduleId);
  }

  /** Text whether a module has already been loaded. */
  isLoaded(moduleId: string): boolean {
    return this.instances.has(moduleId);
  }

  resolve(moduleId: string, context?: ModuleRuntimeContext): ModuleController {
    const existing = this.instances.get(moduleId);
    if (existing) return existing;

    const factory = this.factories.get(moduleId);
    if (!factory) {
      throw new Error(`No controller bound for module: ${moduleId}`);
    }
    const controller = factory(context ?? { moduleId, moduleName: moduleId });
    this.instances.set(moduleId, controller);
    return controller;
  }

  /** Registered (bound) module ids. */
  ids(): string[] {
    return [...this.factories.keys()];
  }
}