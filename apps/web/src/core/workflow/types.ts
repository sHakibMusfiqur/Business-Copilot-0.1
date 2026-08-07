/** Logical category a workflow belongs to. */
export type WorkflowCategory =
  | 'process'
  | 'approval'
  | 'request'
  | 'notification'
  | 'integration'
  | 'custom';

/** Lifecycle status of a registered workflow definition. */
export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'archived';

/** Status of a single workflow run. */
export type WorkflowRunStatus =
  | 'queued'
  | 'pending'
  | 'running'
  | 'waiting'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'timedOut';

/** The class of trigger that can start a workflow. */
export type WorkflowTriggerKind = 'manual' | 'event' | 'schedule';


export type WorkflowStepKind =
  | 'task'
  | 'command'
  | 'query'
  | 'condition'
  | 'wait'
  | 'subflow'
  | 'emit'
  | 'plugin';

/** Discriminated workflow trigger. */
export interface WorkflowManualTrigger {
  readonly type: 'manual';
  /** Human label surfaced in UIs that trigger workflows by hand. */
  readonly label?: string;
}

export interface WorkflowEventTrigger {
  readonly type: 'event';
  /** Event bus event name this workflow subscribes to. */
  readonly event: string;
  /** Optional predicate evaluated against the event payload. */
  readonly where?: (payload: unknown) => boolean;
}

export interface WorkflowScheduleTrigger {
  readonly type: 'schedule';
  /** Cron expression (five fields, standard order). */
  readonly cron?: string;
  /** Optional fixed interval in seconds when cron is absent. */
  readonly seconds?: number;
  /** Optional timezone that a cron is evaluated in. */
  readonly timezone?: string;
  /** Avoid overlapping runs of the same workflow. */
  readonly noOverlap?: boolean;
}

/** Every possible workflow trigger, discriminated on `type`. */
export type WorkflowTrigger =
  | WorkflowManualTrigger
  | WorkflowEventTrigger
  | WorkflowScheduleTrigger;


export interface WorkflowStepBase {
  readonly id: string;
  readonly kind: WorkflowStepKind;
  readonly name?: string;
  /** Human-facing description surfaced in workflow builders. */
  readonly description?: string;
}

/** Run a business task: a plain function executed with the run context. */
export interface WorkflowTaskStep extends WorkflowStepBase {
  readonly kind: 'task';
  /** Resolve inputs from the run context; returns the step output. */
  readonly resolve: (context: WorkflowRunContext) => unknown | Promise<unknown>;
}

/** Dispatch a command through the command bus. */
export interface WorkflowCommandStep extends WorkflowStepBase {
  readonly kind: 'command';
  readonly command: (context: WorkflowRunContext) =>
    | { readonly type: string } & Record<string, unknown>
    | Promise<{ readonly type: string } & Record<string, unknown>>;
}

/** Resolve a query through the query bus (read-only). */
export interface WorkflowQueryStep extends WorkflowStepBase {
  readonly kind: 'query';
  readonly query: (context: WorkflowRunContext) =>
    | { readonly type: string } & Record<string, unknown>
    | Promise<{ readonly type: string } & Record<string, unknown>>;
}

/** Branch based on the given predicate. */
export interface WorkflowConditionStep extends WorkflowStepBase {
  readonly kind: 'condition';
  readonly if: (context: WorkflowRunContext) => boolean | Promise<boolean>;
}

/** Wait for a duration (or until an external signal). */
export interface WorkflowWaitStep extends WorkflowStepBase {
  readonly kind: 'wait';
  readonly delayMs?: (context: WorkflowRunContext) => number | Promise<number>;
  readonly until?: (context: WorkflowRunContext) => boolean | Promise<boolean>;
}

/** Run another registered workflow as a nested step. */
export interface WorkflowSubflowStep extends WorkflowStepBase {
  readonly kind: 'subflow';
  readonly workflowId: string;
}

/** Publish an event on the event bus. */
export interface WorkflowEmitStep extends WorkflowStepBase {
  readonly kind: 'emit';
  readonly event: (context: WorkflowRunContext) =>
    | { type: string; payload: unknown }
    | Promise<{ type: string; payload: unknown }>;
}

/** Delegate execution to a registered plugin by id. */
export interface WorkflowPluginStep extends WorkflowStepBase {
  readonly kind: 'plugin';
  readonly pluginId: string;
}

/** Every executable workflow step, discriminated on `kind`. */
export type WorkflowStep =
  | WorkflowTaskStep
  | WorkflowCommandStep
  | WorkflowQueryStep
  | WorkflowConditionStep
  | WorkflowWaitStep
  | WorkflowSubflowStep
  | WorkflowEmitStep
  | WorkflowPluginStep;

/** Declarative definition of a workflow, ready to register. */
export interface WorkflowDefinition {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly category?: WorkflowCategory;
  readonly status?: WorkflowStatus;
  /** Entry steps; multiple roots run in order unless a condition forks. */
  readonly steps: readonly WorkflowStep[];
  readonly triggers: readonly WorkflowTrigger[];
  readonly enabled?: boolean;
  /** Retry policy applied to every step of this workflow. */
  readonly retries?: { readonly attempts: number; readonly baseDelayMs?: number };
  readonly timeoutMs?: number;
}

/** Runtime context passed to step resolvers and predicates. */
export interface WorkflowRunContext {
  /** The definition being executed. */
  readonly workflow: WorkflowDefinition;
  /** The run this context belongs to. */
  readonly runId: string;
  /** Values collected from prior steps, keyed by step id. */
  readonly cursor: Map<string, unknown>;
  /** Payload that triggered this run (manual value or event payload). */
  readonly trigger: unknown;
}

/** Outcome of an individual step execution. */
export interface WorkflowStepResult {
  readonly stepId: string;
  readonly kind: WorkflowStepKind;
  readonly ok: boolean;
  readonly output?: unknown;
  readonly error?: string;
  readonly elapsedMs: number;
}

/** A completed (or in-flight) workflow run. */
export interface WorkflowRun {
  readonly runId: string;
  readonly workflowId: string;
  readonly status: WorkflowRunStatus;
  readonly createdAt: string;
  readonly startedAt?: string;
  readonly finishedAt?: string;
  readonly trigger: unknown;
  readonly results: readonly WorkflowStepResult[];
  readonly error?: string;
  readonly skippedStepId?: string;
}

/** Public view of a registered workflow. */
export interface WorkflowRecord {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly category: WorkflowCategory | undefined;
  readonly status: WorkflowStatus;
  readonly enabled: boolean;
  readonly stepCount: number;
  readonly triggerCount: number;
  readonly triggerKinds: readonly WorkflowTriggerKind[];
}

/** Immutable snapshot of the workflow engine surfaced for observability. */
export interface WorkflowEngineSnapshot {
  readonly workflowCount: number;
  readonly activeCount: number;
  readonly runCount: number;
  readonly pendingRunCount: number;
  readonly failedRunCount: number;
  readonly records: readonly WorkflowRecord[];
}