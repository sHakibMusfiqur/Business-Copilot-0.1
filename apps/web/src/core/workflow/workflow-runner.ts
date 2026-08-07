import type {
  WorkflowDefinition,
  WorkflowRun,
  WorkflowRunContext,
  WorkflowRunStatus,
  WorkflowStep,
  WorkflowStepKind,
  WorkflowStepResult,
} from './types';
import type { StepExecutionHooks, WorkflowStepRegistry } from './step-registry';

/** Persistent store behind the runner, allowing callers to own durability. */
export interface WorkflowRunStore {
  readonly create: (run: WorkflowRun) => void | Promise<void>;
  readonly update: (run: WorkflowRun) => void | Promise<void>;
}

/** Options controlling a single run. */
export interface RunOptions {
  /** Resolved payload that triggered the run. */
  readonly trigger?: unknown;
  /** External identifier persisted as the run id (correlation). */
  readonly processKey?: string;
}

/** Per-kind retry spec resolved from a workflow's `retries` policy. */
interface RetrySpec {
  readonly kind: WorkflowStepKind;
  readonly attempts: number;
  readonly baseDelayMs: number;
}


export class WorkflowRunner {
  private readonly stepRegistry: WorkflowStepRegistry;
  private readonly store: WorkflowRunStore | undefined;
  private readonly runHooks: StepExecutionHooks;
  private readonly runs = new Map<string, WorkflowRun>();

  constructor(options: {
    stepRegistry: WorkflowStepRegistry;
    hooks: StepExecutionHooks;
    store?: WorkflowRunStore;
  }) {
    this.stepRegistry = options.stepRegistry;
    this.store = options.store;
    this.runHooks = options.hooks;
  }

  /** Every in-memory run for a workflow id, newest last. */
  runsFor(workflowId: string): readonly WorkflowRun[] {
    const matches: WorkflowRun[] = [];
    for (const run of this.runs.values()) {
      if (run.workflowId === workflowId) matches.push(run);
    }
    return matches;
  }

  count(): number {
    return this.runs.size;
  }

  pendingCount(): number {
    let count = 0;
    for (const run of this.runs.values()) {
      if (run.status === 'pending' || run.status === 'running' || run.status === 'waiting') count++;
    }
    return count;
  }

  failedCount(): number {
    let count = 0;
    for (const run of this.runs.values()) {
      if (run.status === 'failed') count++;
    }
    return count;
  }

  /** Run a workflow definition. Returns the final run record. */
  async run(definition: WorkflowDefinition, options: RunOptions = {}): Promise<WorkflowRun> {
    const runId =
      options.processKey ??
      `wf:${definition.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const seed: WorkflowRun = {
      runId,
      workflowId: definition.id,
      status: 'pending',
      createdAt: new Date().toISOString(),
      trigger: options.trigger,
      results: [],
    };
    this.runs.set(runId, seed);
    await this.store?.create(seed);

    const cursor = new Map<string, unknown>();

    const queue = [...definition.steps];
    const retries = this.retriesOf(definition);
    const runnerState = {
      run: this.persist(seed, { status: 'running', startedAt: new Date().toISOString() }),
      cursor,
      definition,
    };
    try {
      while (queue.length > 0) {
        const step = queue.shift() as WorkflowStep;
        const result = await this.executeStep(step, runnerState, retries);
        runnerState.run = this.persist(runnerState.run, { results: [...runnerState.run.results, result] });
        if (!result.ok) {
          return this.finish(runnerState.run, 'failed', result.error);
        }
        if (step.kind === 'condition' && result.output === false) {
          break; // predicate diverged — short-circuit remaining queue
        }
      }
      return this.finish(runnerState.run, 'succeeded');
    } catch (error) {
      return this.finish(runnerState.run, 'failed', toMessage(error));
    }
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private retriesOf(definition: WorkflowDefinition): readonly RetrySpec[] {
    const base = definition.retries;
    if (!base) return [];
    return STEP_KINDS.map((kind) => ({
      kind,
      attempts: base.attempts,
      baseDelayMs: base.baseDelayMs ?? 0,
    }));
  }

  private async executeStep(
    step: WorkflowStep,
    state: { run: WorkflowRun; cursor: Map<string, unknown>; definition: WorkflowDefinition },
    retries: readonly RetrySpec[],
  ): Promise<WorkflowStepResult> {
    const startedAt = Date.now();
    const spec = retries.find((entry) => entry.kind === step.kind);
    const attempts = Math.max(1, spec?.attempts ?? 1);
    let lastError: unknown;
    const context: WorkflowRunContext = {
      workflow: state.definition,
      runId: state.run.runId,
      cursor: state.cursor,
      trigger: state.run.trigger,
    };
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const executor = this.stepRegistry.get(step.kind);
        if (!executor) throw new Error(`No step executor registered for kind: ${step.kind}`);
        const output = await executor(step, context, this.runHooks);
        state.cursor.set(step.id, clonePayload(output));
        return { stepId: step.id, kind: step.kind, ok: true, output, elapsedMs: Date.now() - startedAt };
      } catch (error) {
        lastError = error;
        if (attempt >= attempts) break;
        await this.backoff(spec, attempt);
      }
    }
    return {
      stepId: step.id,
      kind: step.kind,
      ok: false,
      error: toMessage(lastError ?? new Error('Unknown step error')),
      elapsedMs: Date.now() - startedAt,
    };
  }

  private async backoff(spec: RetrySpec | undefined, attempt: number): Promise<void> {
    const base = spec?.baseDelayMs ?? 0;
    if (base <= 0) return;
    await delay(base * attempt);
  }

  private persist(run: WorkflowRun, patch: Partial<WorkflowRun>): WorkflowRun {
    const next = { ...run, ...patch };
    this.runs.set(run.runId, next);
    return next;
  }

  private async finish(run: WorkflowRun, status: WorkflowRunStatus, error?: string): Promise<WorkflowRun> {
    const finished = this.persist(run, {
      status,
      finishedAt: new Date().toISOString(),
      error,
    });
    await this.store?.update(finished);
    return finished;
  }
}

const STEP_KINDS: readonly WorkflowStepKind[] = [
  'task',
  'command',
  'query',
  'condition',
  'wait',
  'subflow',
  'emit',
  'plugin',
];

function clonePayload(value: unknown): unknown {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Create a workflow runner over a step registry + hooks. */
export function createWorkflowRunner(options: {
  stepRegistry: WorkflowStepRegistry;
  hooks: StepExecutionHooks;
  store?: WorkflowRunStore;
}): WorkflowRunner {
  return new WorkflowRunner(options);
}

// Re-exported for convenience through the barrel.
export type { WorkflowStepResult, WorkflowRun, WorkflowRunStatus, WorkflowRunContext };