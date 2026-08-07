import type { BoundWidget } from './widget-registry';
import type {
  DashboardContext,
  WidgetKind,
  WidgetLoadState,
} from './widget-types';

/** A loaded widget module — framework-neutral payload for the renderer. */
export interface WidgetModule {
  readonly key: WidgetKind;
  /** Identifier for the renderer slot (component/module to mount). */
  readonly renderer: string;
  /** Optional runtime config for the renderer. */
  readonly config?: unknown;
}

/** Async factory producing a widget module on demand (lazy/code-split). */
export type WidgetLoaderFn = (
  widget: BoundWidget,
  context: DashboardContext,
) => Promise<WidgetModule> | WidgetModule;

/** Static (non-lazy) module factory keyed by widget key. */
export type WidgetModuleFactory = (widget: BoundWidget) => WidgetModule;

/** Fallback renderer slot used when a widget is not (yet) loadable. */
export const FALLBACK_RENDERER = 'widget.fallback';
/** Loading renderer slot shown while a lazy module is in flight. */
export const LOADING_RENDERER = 'widget.loading';
/** Unknown renderer slot shown when a widget kind has no loader at all. */
export const UNKNOWN_RENDERER = 'widget.unknown';


export class WidgetLoader {
  private readonly loaders = new Map<string, WidgetLoaderFn>();
  private readonly factories = new Map<string, WidgetModuleFactory>();
  private readonly inFlight = new Map<string, Promise<WidgetModule>>();

  /** Register an async (lazy) loader for a widget key. */
  registerLazy(key: string, loader: WidgetLoaderFn): boolean {
    if (this.loaders.has(key)) return false;
    this.loaders.set(key, loader);
    return true;
  }

  /** Register a synchronous module factory for a widget key. */
  registerStatic(key: string, factory: WidgetModuleFactory): boolean {
    if (this.factories.has(key)) return false;
    this.factories.set(key, factory);
    return true;
  }

  /** Whether a widget key has any loader/factory registered. */
  has(key: string): boolean {
    return this.loaders.has(key) || this.factories.has(key);
  }

 
  stateOf(widget: BoundWidget): WidgetLoadState {
    if (this.factories.has(widget.key)) return 'ready';
    if (isKeyInFlight(this.inFlight, widget.key)) return 'loading';
    if (this.loaders.has(widget.key)) return 'lazy';
    return 'unknown';
  }


  async load(widget: BoundWidget, context: DashboardContext): Promise<WidgetModule> {
    const staticModule = this.factories.get(widget.key);
    if (staticModule) return staticModule(widget);

    const loader = this.loaders.get(widget.key);
    if (!loader) {
      return { key: widget.key, renderer: UNKNOWN_RENDERER };
    }

    const fingerprint = fingerprintOf(widget, context);
    let pending = this.inFlight.get(fingerprint);
    if (!pending) {
      pending = Promise.resolve(loader(widget, context)).finally(() => {
        this.inFlight.delete(fingerprint);
      });
      this.inFlight.set(fingerprint, pending);
    }
    return pending;
  }

  /** Whether a lazy load is currently in flight for a key. */
  isPending(key: string): boolean {
    return isKeyInFlight(this.inFlight, key);
  }

  /** Drop cached in-flight work (e.g. on context switch). */
  clearPending(): void {
    this.inFlight.clear();
  }
}

function fingerprintOf(widget: BoundWidget, context: DashboardContext): string {
  return `${widget.key}|${context.role}|${context.industry}|${context.aiEnabled}|${context.plan ?? ''}`;
}

/** Whether a widget key has any in-flight (lazy) load. */
function isKeyInFlight(
  inFlight: ReadonlyMap<string, Promise<WidgetModule>>,
  key: string,
): boolean {
  for (const fingerprint of inFlight.keys()) {
    if (fingerprint.startsWith(`${key}|`)) return true;
  }
  return false;
}
