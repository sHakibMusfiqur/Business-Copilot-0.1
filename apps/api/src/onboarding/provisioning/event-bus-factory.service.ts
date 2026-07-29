import { Injectable, Logger } from '@nestjs/common';
import type { ProvisionEventBus } from './provision-event-bus.interface';
import { LocalEventBus } from './local-event-bus.service';

export type EventBusType = 'local' | 'redis' | 'nats' | 'kafka';

export interface EventBusFactoryOptions {
  type: EventBusType;
  connection?: Record<string, unknown>;
}

export interface EventBusProvider {
  readonly type: EventBusType;
  create(options?: Record<string, unknown>): ProvisionEventBus;
}

@Injectable()
export class EventBusFactory {
  private readonly logger = new Logger(EventBusFactory.name);
  private readonly providers = new Map<EventBusType, EventBusProvider>();

  constructor(private readonly localEventBus: LocalEventBus) {
    this.register({ type: 'local', create: () => this.localEventBus });
  }

  register(provider: EventBusProvider): void {
    if (this.providers.has(provider.type)) {
      this.logger.warn(`Overwriting existing event bus provider: ${provider.type}`);
    }
    this.providers.set(provider.type, provider);
  }

  create(options: EventBusFactoryOptions): ProvisionEventBus {
    const provider = this.providers.get(options.type);
    if (!provider) {
      this.logger.warn(`Unknown event bus type "${options.type}", falling back to local`);
      return this.localEventBus;
    }
    this.logger.log(`Creating event bus: ${options.type}`);
    return provider.create(options.connection);
  }

  getAvailableTypes(): EventBusType[] {
    return Array.from(this.providers.keys());
  }
}
