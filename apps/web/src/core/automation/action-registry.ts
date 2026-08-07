import type {
  AutomationAction,
  AutomationActionKind,
  AutomationContext,
} from './types';

/** Executes a single automation action and returns its outcome. */
export interface AutomationActionHooks {
  /** Dispatch a command through the command bus. */
  readonly executeCommand: (command: {
    readonly type: string;
  } & Record<string, unknown>) => Promise<unknown>;
  /** Publish an event on the event bus. */
  readonly publishEvent: (event: { type: string; payload: unknown }) => Promise<void>;
  /** Run a workflow by id. */
  readonly runWorkflow: (workflowId: string, payload?: unknown) => Promise<unknown>;
}

/** Map each action kind to its concrete action type for precise typing. */
export type ActionByKind = {
  notify: AutomationAction & { readonly type: 'notify' };
  workflow: AutomationAction & { readonly type: 'workflow' };
  command: AutomationAction & { readonly type: 'command' };
  event: AutomationAction & { readonly type: 'event' };
  log: AutomationAction & { readonly type: 'log' };
  plugin: AutomationAction & { readonly type: 'plugin' };
};


export type ActionExecutor<K extends AutomationActionKind = AutomationActionKind> = (
  action: ActionByKind[K],
  context: AutomationContext,
  hooks: AutomationActionHooks,
) => unknown | Promise<unknown>;


export class AutomationActionRegistry {
  private readonly byKind = new Map<AutomationActionKind, ActionExecutor>();

  /** Register (or overwrite) an executor for an action kind. */
  register<K extends AutomationActionKind>(kind: K, executor: ActionExecutor<K>): this {
    this.byKind.set(kind, executor as ActionExecutor);
    return this;
  }

  has(kind: string): boolean {
    return this.byKind.has(kind as AutomationActionKind);
  }

  get<K extends AutomationActionKind>(kind: K): ActionExecutor<K> | undefined {
    return this.byKind.get(kind) as ActionExecutor<K> | undefined;
  }

  kinds(): readonly AutomationActionKind[] {
    return [...this.byKind.keys()];
  }
}

/** Create a new, empty automation action registry. */
export function createActionRegistry(): AutomationActionRegistry {
  return new AutomationActionRegistry();
}

export type { AutomationActionKind, AutomationAction, AutomationContext };