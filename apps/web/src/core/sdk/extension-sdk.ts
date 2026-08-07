import type {
  Command,
  CommandDefinition,
  CommandMiddleware,
  CommandResult,
  CommandValidator,
} from '../commands';
import type {
  EventHandler,
  EventMap,
  EventMiddleware,
  Unsubscribe,
  WildcardHandler,
} from '../events';
import type {
  Query,
  QueryDefinition,
  QueryOptions,
  QueryResponse,
} from '../queries';
import type {
  ModuleController,
  ModuleControllerFactory,
  ModuleRuntimeContext,
} from '../modules';

/**
 * The Extension SDK is the supported boundary for extensions (plugins, business
 * modules, accelerators). It exposes typed event/command/query surfaces plus
 * module-controller registration, without leaking internal bus internals.
 *
 * Extensions receive a thin facade bound to the shared platform buses, so they
 * publish and subscribe over the same channels as the platform itself.
 */
export interface ExtensionSDK {
  /** Typed event subscription surface. */
  readonly events: EventSurface;
  /** Typed command registration surface. */
  readonly commands: CommandSurface;
  /** Typed query registration surface. */
  readonly queries: QuerySurface;
  /** Lazy module-controller registration. Returns false when already bound. */
  bindController: (moduleId: string, factory: ModuleControllerFactory) => boolean;
  /** Aggregate snapshot of the SDK surfaces. */
  snapshot: () => ExtensionSdkSnapshot;
}

/** Typed event-surface granted to extensions. */
export interface EventSurface {
  on: (event: string, handler: EventHandler<unknown>) => Unsubscribe;
  onAny: (handler: WildcardHandler) => Unsubscribe;
  once: (event: string, handler: EventHandler<unknown>) => Unsubscribe;
  publish: (event: string, payload: unknown) => Promise<void>;
  use: (middleware: EventMiddleware) => void;
}

/** Typed command-surface granted to extensions. */
export interface CommandSurface {
  register: <C extends Command>(definition: CommandDefinition<C>) => boolean;
  validate: <C extends Command>(type: C['type'], validator: CommandValidator<C>) => void;
  use: (middleware: CommandMiddleware) => void;
  execute: (command: Command) => Promise<CommandResult>;
}

/** Typed query-surface granted to extensions. */
export interface QuerySurface {
  register: <Q extends Query, R extends QueryResponse>(definition: QueryDefinition<Q, R>) => boolean;
  execute: <Q extends Query, R extends QueryResponse>(query: Q, options?: QueryOptions) => Promise<R>;
  invalidate: <Q extends Query>(query: Q) => boolean;
  clearType: (type: string) => void;
  clearCache: () => void;
}

/** Immutable snapshot of what an SDK currently mediates. */
export interface ExtensionSdkSnapshot {
  readonly listenerCount: number;
  readonly commandCount: number;
  readonly queryCount: number;
  readonly boundModules: number;
}

/** Dependencies the SDK facade is constructed over. */
export interface ExtensionSdkDeps {
  readonly events: {
    readonly on: (event: string, handler: EventHandler<unknown>) => Unsubscribe;
    readonly onAny: (handler: WildcardHandler) => Unsubscribe;
    readonly once: (event: string, handler: EventHandler<unknown>) => Unsubscribe;
    readonly publish: (event: string, payload: unknown) => Promise<void>;
    readonly use: (middleware: EventMiddleware) => void;
    readonly listenerCount: () => number;
  };
  readonly commands: {
    readonly register: <C extends Command>(definition: CommandDefinition<C>) => boolean;
    readonly validate: <C extends Command>(type: C['type'], validator: CommandValidator<C>) => void;
    readonly use: (middleware: CommandMiddleware) => void;
    readonly execute: (command: Command) => Promise<CommandResult>;
    readonly size: () => number;
  };
  readonly queries: {
    readonly register: <Q extends Query, R extends QueryResponse>(definition: QueryDefinition<Q, R>) => boolean;
    readonly execute: <Q extends Query, R extends QueryResponse>(query: Q, options?: QueryOptions) => Promise<R>;
    readonly invalidate: <Q extends Query>(query: Q) => boolean;
    readonly clearType: (type: string) => void;
    readonly clearCache: () => void;
    readonly size: () => number;
  };
  readonly controllers: {
    readonly bind: (moduleId: string, factory: ModuleControllerFactory) => boolean;
    readonly size: () => number;
  };
}

/** Construct an Extension SDK over shared platform surfaces. */
export function createExtensionSDK(deps: ExtensionSdkDeps): ExtensionSDK {
  return {
    events: {
      on: deps.events.on,
      onAny: deps.events.onAny,
      once: deps.events.once,
      publish: deps.events.publish,
      use: deps.events.use,
    },
    commands: {
      register: deps.commands.register,
      validate: deps.commands.validate,
      use: deps.commands.use,
      execute: deps.commands.execute,
    },
    queries: {
      register: deps.queries.register,
      execute: deps.queries.execute,
      invalidate: deps.queries.invalidate,
      clearType: deps.queries.clearType,
      clearCache: deps.queries.clearCache,
    },
    bindController: deps.controllers.bind,
    snapshot: () => ({
      listenerCount: deps.events.listenerCount(),
      commandCount: deps.commands.size(),
      queryCount: deps.queries.size(),
      boundModules: deps.controllers.size(),
    }),
  };
}

/** A ready-made SDK context handed to a module controller factory. */
export interface ExtensionModuleContext extends ModuleRuntimeContext {
  readonly sdk: ExtensionSDK;
}

/** Adapter binding the {@link ModuleController} shape to an SDK closure. */
export type ModuleControllerAdapter = (context: ExtensionModuleContext) => ModuleController;

export type {
  Command,
  CommandDefinition,
  CommandMiddleware,
  CommandResult,
  CommandValidator,
  EventHandler,
  EventMiddleware,
  EventMap,
  Query,
  QueryDefinition,
  QueryOptions,
  QueryResponse,
  Unsubscribe,
  WildcardHandler,
  ModuleController,
  ModuleControllerFactory,
  ModuleRuntimeContext,
};