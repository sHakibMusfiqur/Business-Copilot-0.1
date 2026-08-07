import type {
  WorkflowRunContext,
  WorkflowCommandStep,
  WorkflowConditionStep,
  WorkflowEmitStep,
  WorkflowPluginStep,
  WorkflowQueryStep,
  WorkflowStepKind,
  WorkflowSubflowStep,
  WorkflowTaskStep,
  WorkflowWaitStep,
} from './types';

/** Map each step kind to its concrete step type, for precise executor typing. */
export type StepByKind = {
  task: WorkflowTaskStep;
  command: WorkflowCommandStep;
  query: WorkflowQueryStep;
  condition: WorkflowConditionStep;
  wait: WorkflowWaitStep;
  subflow: WorkflowSubflowStep;
  emit: WorkflowEmitStep;
  plugin: WorkflowPluginStep;
};

/** Bus + engine hooks made available to step executors. */
export interface StepExecutionHooks {
  /** Dispatch a command through the command bus. */
  readonly executeCommand: (command: {
    readonly type: string;
  } & Record<string, unknown>) => Promise<unknown>;
  /** Resolve a query through the query bus. */
  readonly executeQuery: (query: {
    readonly type: string;
  } & Record<string, unknown>) => Promise<unknown>;
  /** Publish an event on the event bus. */
  readonly publishEvent: (event: { type: string; payload: unknown }) => Promise<void>;
  /** Run a registered workflow as a subflow. */
  readonly runSubflow: (workflowId: string, context: WorkflowRunContext) => Promise<unknown>;
}


export type StepExecutor<K extends WorkflowStepKind = WorkflowStepKind> = (
  step: StepByKind[K],
  context: WorkflowRunContext,
  hooks: StepExecutionHooks,
) => unknown | Promise<unknown>;

/** Public view of a registered step executor. */
export interface StepExecutorRecord {
  readonly kind: WorkflowStepKind;
  readonly executor: StepExecutor;
}


export class WorkflowStepRegistry {
  private readonly byKind = new Map<WorkflowStepKind, StepExecutor>();

  /** Register an executor for a step kind. Overwrites an existing binding. */
  register<K extends WorkflowStepKind>(kind: K, executor: StepExecutor<K>): this {
    this.byKind.set(kind, executor as StepExecutor);
    return this;
  }

  has(kind: string): boolean {
    return this.byKind.has(kind as WorkflowStepKind);
  }

  /** Resolve an executor by kind, or undefined when unregistered. */
  get<K extends WorkflowStepKind>(kind: K): StepExecutor<K> | undefined {
    return this.byKind.get(kind) as StepExecutor<K> | undefined;
  }

  /** List every registered executor (for validation and snapshots). */
  list(): readonly StepExecutorRecord[] {
    return [...this.byKind.entries()].map(([kind, executor]) => ({ kind, executor }));
  }

  kinds(): readonly WorkflowStepKind[] {
    return [...this.byKind.keys()];
  }
}

/** Create a new, empty step registry. */
export function createStepRegistry(): WorkflowStepRegistry {
  return new WorkflowStepRegistry();
}