import type {
  WorkflowDefinition,
  WorkflowEngineSnapshot,
  WorkflowRecord,
  WorkflowRun,
} from './types';
import { scheduleOccurrences } from './scheduler';
import type { StepExecutionHooks , WorkflowStepRegistry } from './step-registry';
import { createStepRegistry } from './step-registry';
import type { WorkflowTriggerSignal , WorkflowTriggerRegistry } from './trigger-registry';
import { createTriggerRegistry } from './trigger-registry';
import type { WorkflowRegistry } from './workflow-registry';
import { createWorkflowRegistry } from './workflow-registry';
import type { WorkflowRunner } from './workflow-runner';
import { createWorkflowRunner } from './workflow-runner';

/** External bus surfaces the engine can drive. */
export interface WorkflowEngineBuses {
  /** Dispatch a command through the command bus. */
  readonly command?: (command: {
    readonly type: string;
  } & Record<string, unknown>) => Promise<unknown>;
  /** Resolve a query through the query bus. */
  readonly query?: (query: {
    readonly type: string;
  } & Record<string, unknown>) => Promise<unknown>;
  /** Publish an event on the event bus. */
  readonly event?: (event: { type: string; payload: unknown }) => Promise<void>;
  /** Subscribe to an event; returns an unsubscribe function. */
  readonly subscribe?: (event: string, handler: (payload: unknown) => void) => () => void;
}


export interface WorkflowEngineOptions {
  readonly buses?: WorkflowEngineBuses;
  readonly registry?: WorkflowRegistry;
  readonly steps?: WorkflowStepRegistry;
  readonly triggers?: WorkflowTriggerRegistry;
  readonly runner?: WorkflowRunner;
}


export class WorkflowEngine {
  readonly registry: WorkflowRegistry;
  readonly steps: WorkflowStepRegistry;
  readonly triggers: WorkflowTriggerRegistry;
  readonly runner: WorkflowRunner;

  private readonly buses: WorkflowEngineBuses;
  private readonly unsubscribers: Array<() => void> = [];

  constructor(options: WorkflowEngineOptions = {}) {
    this.buses = {
      command: options.buses?.command,
      query: options.buses?.query,
      event: options.buses?.event,
      subscribe: options.buses?.subscribe,
    };
    this.registry = options.registry ?? createWorkflowRegistry();
    this.steps = options.steps ?? createStepRegistry();
    this.triggers = options.triggers ?? createTriggerRegistry();
    this.runner =
      options.runner ??
      createWorkflowRunner({
        stepRegistry: this.steps,
        hooks: this.hooks(),
      });
    // Only seed the built-in executors when we own the registries; injected
    // registries belong to the caller and may already carry plugin bindings.
    if (options.steps === undefined) this.seedDefaultSteps();
    if (options.triggers === undefined) this.seedDefaultTriggers();
  }

  /** Register a workflow definition. Returns false on id collision. */
  register(definition: WorkflowDefinition): boolean {
    if (!this.registry.register(definition)) return false;
    this.subscribeEventTriggers(definition);
    return true;
  }

  /** Register several definitions. Returns false when any collided. */
  registerMany(definitions: readonly WorkflowDefinition[]): boolean {
    return definitions.every((definition) => this.register(definition));
  }

  has(id: string): boolean {
    return this.registry.has(id);
  }

  get(id: string): WorkflowDefinition | undefined {
    return this.registry.get(id);
  }

  record(id: string): WorkflowRecord | undefined {
    return this.registry.record(id);
  }

  /** Run a workflow by id. Returns the run, or throws when unknown. */
  async run(id: string, trigger?: unknown): Promise<WorkflowRun> {
    const definition = this.registry.get(id);
    if (!definition) throw new Error(`Workflow not registered: ${id}`);
    return this.runner.run(definition, { trigger });
  }

 
  async dispatch(signal: WorkflowTriggerSignal): Promise<WorkflowRun[]> {
    const launches: WorkflowRun[] = [];
    for (const definition of this.registry.all()) {
      if (definition.enabled === false) continue;
for (const trigger of definition.triggers) {
        if (!this.triggers.evaluate(trigger, signal)) continue;
        launches.push(await this.runner.run(definition, { trigger: 'payload' in signal ? signal.payload : undefined, processKey: undefined }));
        break;
      }
    }
    return launches;
  }

  /** Manually fire a workflow by id. Shorthand for `run`. */
  async manual(id: string, payload?: unknown): Promise<WorkflowRun> {
    return this.run(id, payload);
  }

  /** Launches every schedule-triggered workflow due at `at`. */
  async reapSchedules(at = new Date()): Promise<WorkflowRun[]> {
    const launches: WorkflowRun[] = [];
    for (const definition of this.registry.all()) {
      if (definition.enabled === false) continue;
      for (const trigger of definition.triggers) {
        if (trigger.type !== 'schedule') continue;
        const occurrences = scheduleOccurrences(trigger, at);
        if (occurrences.length === 0) continue;
        const signal: WorkflowTriggerSignal = { kind: 'schedule', at: occurrences[0] };
        if (this.triggers.evaluate(trigger, signal)) {
          launches.push(await this.runner.run(definition, { trigger: occurrences[0].toISOString() }));
        }
      }
    }
    return launches;
  }

  /** Close the engine: unsubscribe from the event bus. */
  dispose(): void {
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers.length = 0;
  }

  /** Immutable snapshot of the engine's state. */
  snapshot(): WorkflowEngineSnapshot {
    const all = this.registry.all();
    const records = all
      .map((definition) => this.registry.record(definition.id))
      .filter((record): record is WorkflowRecord => record !== undefined);
    return {
      workflowCount: all.length,
      activeCount: records.filter((record) => record.enabled).length,
      runCount: this.runner.count(),
      pendingRunCount: this.runner.pendingCount(),
      failedRunCount: this.runner.failedCount(),
      records,
    };
  }

  // ── Internals ────────────────────────────────────────────────────────────

  /** Subscribe each event-triggered workflow to its event when a bus is wired. */
  private subscribeEventTriggers(definition: WorkflowDefinition): void {
    const subscribe = this.buses.subscribe;
    if (!subscribe) return;
    for (const trigger of definition.triggers) {
      if (trigger.type !== 'event') continue;
      const unsubscribe = subscribe(trigger.event, (payload) => {
        if (definition.enabled === false) return;
        if (trigger.where && !trigger.where(payload)) return;
        void this.runner.run(definition, { trigger: payload });
      });
      this.unsubscribers.push(unsubscribe);
      break; // subscribe once per workflow (first event trigger)
    }
  }

  /** Install the built-in step executors (task/command/query/condition/wait/emit/subflow/plugin). */
  private seedDefaultSteps(): void {
    const buses = this.buses;
    this.steps.register<'task'>('task', (step, context) => step.resolve(context));
    this.steps.register<'command'>('command', async (step, context) => {
      if (!buses.command) throw new Error('Command bus not available');
      return buses.command(await step.command(context));
    });
    this.steps.register<'query'>('query', async (step, context) => {
      if (!buses.query) throw new Error('Query bus not available');
      return buses.query(await step.query(context));
    });
    this.steps.register<'condition'>('condition', async (step, context) => Boolean(await step.if(context)));
    this.steps.register<'wait'>('wait', async (step, context) => {
      if (step.delayMs) {
        const delayMs = await step.delayMs(context);
        if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      if (step.until) return Boolean(await step.until(context));
      return 0;
    });
    this.steps.register<'emit'>('emit', async (step, context, hooks) => {
      const event = await step.event(context);
      await hooks.publishEvent(event);
      return event;
    });
    this.steps.register<'subflow'>('subflow', async (step, context, hooks) => hooks.runSubflow(step.workflowId, context));
    this.steps.register<'plugin'>('plugin', () => {
      throw new Error('Plugin step execution requires the plugin registry to be wired');
    });
  }

  private seedDefaultTriggers(): void {
    this.triggers.register('manual', (trigger, signal) => signal.kind === 'manual' && trigger.type === 'manual');
    this.triggers.register('event', (trigger, signal) => {
      if (signal.kind !== 'event' || trigger.type !== 'event') return false;
      if (trigger.event !== signal.event) return false;
      return trigger.where ? trigger.where(signal.payload) : true;
    });
    this.triggers.register('schedule', (trigger, signal) => {
      if (signal.kind !== 'schedule' || trigger.type !== 'schedule') return false;
      return true; // signal generated by scheduleOccurrences for this trigger
    });
  }

  /** Construct the hooks handed to step executors. */
  private hooks(): StepExecutionHooks {
    return {
      executeCommand: async (command) => {
        if (!this.buses.command) throw new Error('Command bus not configured');
        return this.buses.command(command);
      },
      executeQuery: async (query) => {
        if (!this.buses.query) throw new Error('Query bus not configured');
        return this.buses.query(query);
      },
      publishEvent: async (event) => {
        if (!this.buses.event) throw new Error('Event bus not configured');
        return this.buses.event(event);
      },
      runSubflow: async (workflowId) => {
        const definition = this.registry.get(workflowId);
        if (!definition) throw new Error(`Subflow not registered: ${workflowId}`);
        const run = await this.runner.run(definition, { trigger: undefined });
        return run;
      },
    };
  }
}

/** Create a workflow engine with default registries + buses. */
export function createWorkflowEngine(options: WorkflowEngineOptions = {}): WorkflowEngine {
  return new WorkflowEngine(options);
}
