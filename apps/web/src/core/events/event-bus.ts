import type {
  EventEnvelope,
  EventHandler,
  EventMap,
  EventMiddleware,
  EventBusSnapshot,
  Unsubscribe,
  WildcardHandler,
} from './types';

interface ListenerEntry {
  handler: EventHandler<unknown>;
  once: boolean;
}

/**
 * Enterprise Event Bus.
 *
 * A fully typed, dependency-free in-process pub/sub. Supports typed events,
 * async handlers, once-listeners, wildcard listeners and a middleware pipeline
 * that runs once per publish. Listeners are keyed per event type and notified
 * in registration order; a single failing handler does not prevent the others.
 */
export class EventBus<M extends EventMap = EventMap> {
  private readonly listeners = new Map<string, ListenerEntry[]>();
  private readonly wildcards: WildcardHandler[] = [];
  private readonly middleware: EventMiddleware[] = [];

  /** Register middleware. Middleware runs per publish, before listeners. */
  use(middleware: EventMiddleware): this {
    this.middleware.push(middleware);
    return this;
  }

  /** Subscribe a typed handler to an event. Returns an unsubscribe function. */
  subscribe<K extends keyof M & string>(event: K, handler: EventHandler<M[K]>): Unsubscribe {
    return this.add(event, handler as EventHandler<unknown>, false);
  }

  /** Subscribe a one-shot typed handler. Returns an unsubscribe function. */
  once<K extends keyof M & string>(event: K, handler: EventHandler<M[K]>): Unsubscribe {
    return this.add(event, handler as EventHandler<unknown>, true);
  }

  /** Subscribe to every published event. Returns an unsubscribe function. */
  onAny(handler: WildcardHandler): Unsubscribe {
    this.wildcards.push(handler);
    return () => {
      const index = this.wildcards.indexOf(handler);
      if (index !== -1) this.wildcards.splice(index, 1);
    };
  }

  /** Remove a specific handler from an event. */
  unsubscribe<K extends keyof M & string>(event: K, handler: EventHandler<M[K]>): boolean {
    const entries = this.listeners.get(event);
    if (!entries) return false;
    const index = entries.findIndex((entry) => entry.handler === (handler as EventHandler<unknown>));
    if (index === -1) return false;
    entries.splice(index, 1);
    if (entries.length === 0) this.listeners.delete(event);
    return true;
  }

  /**
   * Publish an event. All handlers are awaited; a rejected handler is caught
   * and the remaining listeners still fire. Resolves once every handler has
   * settled. When `throwOnError` is true, the first handler error is rethrown
   * after all handlers have run.
   */
  async publish<K extends keyof M & string>(event: K, payload: M[K], options: { throwOnError?: boolean } = {}): Promise<void> {
    const envelope: EventEnvelope = { type: event, payload };
    let failure: unknown;
    const dispatch = (): Promise<void> => this.dispatch(envelope, (error: unknown) => {
      failure ??= error;
    });
    const run = async (index: number): Promise<void> => {
      const layer = this.middleware[index];
      if (!layer) {
        await dispatch();
        return;
      }
      await layer(envelope, () => run(index + 1));
    };
    await run(0);
    if (options.throwOnError && failure !== undefined) {
      throw failure;
    }
  }

  /** Number of handlers registered for a specific event (or total when omitted). */
  listenerCount(event?: string): number {
    if (event !== undefined) {
      return this.listeners.get(event)?.length ?? 0;
    }
    let total = 0;
    for (const entries of this.listeners.values()) total += entries.length;
    return total + this.wildcards.length;
  }

  /** Remove all listeners and middleware. */
  clear(): void {
    this.listeners.clear();
    this.wildcards.length = 0;
    this.middleware.length = 0;
  }

  /** Immutable snapshot for observability. */
  snapshot(): EventBusSnapshot {
    return {
      typeCount: this.listeners.size,
      listenerCount: this.listenerCount(),
      middlewareCount: this.middleware.length,
    };
  }

  private add(event: string, handler: EventHandler<unknown>, once: boolean): Unsubscribe {
    const entries = this.listeners.get(event) ?? [];
    const entry: ListenerEntry = { handler, once };
    entries.push(entry);
    this.listeners.set(event, entries);
    return () => {
      const current = this.listeners.get(event);
      if (!current) return;
      const index = current.indexOf(entry);
      if (index !== -1) {
        current.splice(index, 1);
        if (current.length === 0) this.listeners.delete(event);
      }
    };
  }

  private async dispatch(envelope: EventEnvelope, onError: (error: unknown) => void): Promise<void> {
    const specific = this.listeners.get(envelope.type);
    const entries = [...(specific ?? []), ...this.wildcards.map((handler) => ({ handler, once: false } as ListenerEntry))];
    for (const entry of entries) {
      try {
        if (entry.handler !== undefined) {
          await (entry.handler as EventHandler<unknown>)(envelope.payload);
        }
      } catch (error) {
        onError(error);
      } finally {
        if (entry.once) {
          this.unsubscribe(envelope.type, entry.handler as EventHandler<unknown>);
        }
      }
    }
  }
}

/** Create a new typed event bus. */
export function createEventBus<M extends EventMap>(): EventBus<M> {
  return new EventBus<M>();
}