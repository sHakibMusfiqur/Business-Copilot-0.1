import { Injectable, Logger } from '@nestjs/common';
import type { ProvisionDispatcher } from './provision-dispatcher.interface';
import { ImmediateExecutionDispatcher } from './immediate-execution-dispatcher.service';

export type DispatcherType = 'immediate' | 'queue' | 'scheduler' | 'remote';

export interface DispatcherFactoryOptions {
  type: DispatcherType;
  connection?: Record<string, unknown>;
}

export interface DispatcherProvider {
  readonly type: DispatcherType;
  create(options?: Record<string, unknown>): ProvisionDispatcher;
}

@Injectable()
export class DispatcherFactory {
  private readonly logger = new Logger(DispatcherFactory.name);
  private readonly providers = new Map<DispatcherType, DispatcherProvider>();

  constructor(private readonly immediateDispatcher: ImmediateExecutionDispatcher) {
    this.register({ type: 'immediate', create: () => this.immediateDispatcher });
  }

  register(provider: DispatcherProvider): void {
    if (this.providers.has(provider.type)) {
      this.logger.warn(`Overwriting existing dispatcher provider: ${provider.type}`);
    }
    this.providers.set(provider.type, provider);
  }

  create(options: DispatcherFactoryOptions): ProvisionDispatcher {
    const provider = this.providers.get(options.type);
    if (!provider) {
      this.logger.warn(`Unknown dispatcher type "${options.type}", falling back to immediate`);
      return this.immediateDispatcher;
    }
    this.logger.log(`Creating dispatcher: ${options.type}`);
    return provider.create(options.connection);
  }

  getAvailableTypes(): DispatcherType[] {
    return Array.from(this.providers.keys());
  }
}
