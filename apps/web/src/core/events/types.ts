/** A typed map of event name -> payload type for a concrete bus. */
export type EventMap = Record<string, unknown>;

/** Handler for a strongly-typed event. May be async. */
export type EventHandler<P = unknown> = (payload: P) => void | Promise<void>;

/** Wildcard listener — receives every published event's name and payload. */
export type WildcardHandler = (event: string, payload: unknown) => void | Promise<void>;

/** Throwable returned by subscribe/once to detach a listener. */
export type Unsubscribe = () => void;

/** The event being dispatched through middleware. */
export interface EventEnvelope {
  readonly type: string;
  readonly payload: unknown;
}

/**
 * Middleware around event dispatch. Call `next()` to continue the pipeline;
 * return (or await) to short-circuit. Middleware runs once per publish, before
 * the matched listeners fire.
 */
export type EventMiddleware = (event: EventEnvelope, next: () => Promise<void>) => Promise<void>;

/** Immutable snapshot of the listeners registered on a bus. */
export interface EventBusSnapshot {
  readonly typeCount: number;
  readonly listenerCount: number;
  readonly middlewareCount: number;
}