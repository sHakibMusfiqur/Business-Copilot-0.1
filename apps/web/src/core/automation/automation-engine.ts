import type {
  AutomationActionResult,
  AutomationEngineSnapshot,
  AutomationEvaluation,
  AutomationRecord,
  AutomationRule,
  AutomationTrigger,
} from './types';
import type { AutomationActionRegistry } from './action-registry';
import { createActionRegistry } from './action-registry';
import type { AutomationRegistry } from './automation-registry';
import { createAutomationRegistry } from './automation-registry';
import { scheduleOccurrences } from '../workflow/scheduler';
import type { Logger } from '../logger';


export interface AutomationEngineBuses {
  readonly command?: (command: {
    readonly type: string;
  } & Record<string, unknown>) => Promise<unknown>;
  readonly event?: (event: { type: string; payload: unknown }) => Promise<void>;
  readonly runWorkflow?: (workflowId: string, payload?: unknown) => Promise<unknown>;
  /** Subscribe to an event; returns an unsubscribe function. */
  readonly subscribe?: (event: string, handler: (payload: unknown) => void) => () => void;
}


export interface AutomationEngineOptions {
  readonly buses?: AutomationEngineBuses;
  readonly registry?: AutomationRegistry;
  readonly actions?: AutomationActionRegistry;
  readonly logger?: Logger;
}


export class AutomationEngineImp implements AutomationEngine {
  readonly registry: AutomationRegistry;
  readonly actions: AutomationActionRegistry;

  private readonly buses: AutomationEngineBuses;
  private readonly logger?: Logger;
  private readonly unsubscribers: Array<() => void> = [];
  private evaluations = 0;
  private failedActions = 0;

  constructor(options: AutomationEngineOptions = {}) {
    this.buses = options.buses ?? {};
    this.registry = options.registry ?? createAutomationRegistry();
    this.actions = options.actions ?? createActionRegistry();
    this.logger = options.logger;
    if (options.actions === undefined) this.seedDefaultActions();
  }

  /** Register an automation rule. Returns false on id collision. */
  register(rule: AutomationRule): boolean {
    if (!this.registry.register(rule)) return false;
    this.subscribeEventTrigger(rule);
    return true;
  }

  has(id: string): boolean {
    return this.registry.has(id);
  }

  get(id: string): AutomationRule | undefined {
    return this.registry.get(id);
  }

  record(id: string): AutomationRecord | undefined {
    return this.registry.record(id);
  }

  
  async evaluateEvent(event: string, payload: unknown): Promise<AutomationEvaluation[]> {
    const evaluations: AutomationEvaluation[] = [];
    for (const rule of this.registry.all()) {
      if (rule.enabled === false) continue;
      if (rule.trigger.type !== 'event') continue;
      if (rule.trigger.event !== event) continue;
      if (rule.trigger.match && !rule.trigger.match(payload)) continue;
      evaluations.push(await this.execute(rule, payload));
    }
    return evaluations;
  }

 
  async evaluateSchedules(at = new Date()): Promise<AutomationEvaluation[]> {
    const evaluations: AutomationEvaluation[] = [];
    for (const rule of this.registry.all()) {
      if (rule.enabled === false) continue;
      if (rule.trigger.type !== 'schedule') continue;
      const matches = this.scheduleMatches(rule.trigger, at);
      if (!matches) continue;
      evaluations.push(await this.execute(rule, at.toISOString()));
    }
    return evaluations;
  }

  /** Manually fire a rule by id with an arbitrary payload. */
  async manual(id: string, payload?: unknown): Promise<AutomationEvaluation> {
    const rule = this.registry.get(id);
    if (!rule) throw new Error(`Automation rule not registered: ${id}`);
    if (rule.trigger.type === 'event' && rule.trigger.match && !rule.trigger.match(payload)) {
      return { ruleId: id, matched: false, results: [] };
    }
    return this.execute(rule, payload);
  }

  /** Close the engine: unsubscribe from the event bus. */
  dispose(): void {
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers.length = 0;
  }

  /** Immutable snapshot of the engine's state. */
  snapshot(): AutomationEngineSnapshot {
    const all = this.registry.all();
    const records = all
      .map((rule) => this.registry.record(rule.id))
      .filter((record): record is AutomationRecord => record !== undefined);
    return {
      ruleCount: all.length,
      activeCount: records.filter((record) => record.enabled).length,
      evaluationCount: this.evaluations,
      failedActionCount: this.failedActions,
      records,
    };
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private async execute(rule: AutomationRule, payload: unknown): Promise<AutomationEvaluation> {
    this.evaluations++;
    const context = { rule, payload, triggeredAt: new Date().toISOString() };
    const results: AutomationActionResult[] = [];
    for (let index = 0; index < rule.actions.length; index++) {
      const action = rule.actions[index];
      const startedAt = Date.now();
      try {
        const executor = this.actions.get(action.type);
        if (!executor) throw new Error(`No action executor registered for kind: ${action.type}`);
        await executor(action, context, this.hooks());
        results.push({
          ruleId: rule.id,
          actionIndex: index,
          action,
          ok: true,
          elapsedMs: Date.now() - startedAt,
        });
      } catch (error) {
        this.failedActions += 1;
        results.push({
          ruleId: rule.id,
          actionIndex: index,
          action,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          elapsedMs: Date.now() - startedAt,
        });
      }
    }
    return { ruleId: rule.id, matched: true, results };
  }

  private scheduleMatches(trigger: AutomationTrigger, at: Date): boolean {
    if (trigger.type !== 'schedule') return false;
    if (trigger.seconds) {
      const periodMs = trigger.seconds * 1000;
      return Math.floor(at.getTime() / periodMs) === at.getTime() / 1000 / trigger.seconds;
    }
    if (trigger.cron) {
      try {
        const occurrences = scheduleOccurrences(
          { cron: trigger.cron, upTo: new Date(at.getTime() + 1) },
          new Date(at.getTime() - 1),
        );
        return occurrences.some((occ) => Math.abs(occ.getTime() - at.getTime()) < 2000);
      } catch {
        return false;
      }
    }
    return false;
  }

  private subscribeEventTrigger(rule: AutomationRule): void {
    if (rule.trigger.type !== 'event') return;
    const subscribe = this.buses.subscribe;
    if (!subscribe) return;
    const eventName = rule.trigger.event;
    const match = rule.trigger.match;
    const unsubscribe = subscribe(eventName, (payload) => {
      if (rule.enabled === false) return;
      if (match && !match(payload)) return;
      void this.evaluateEvent(eventName, payload);
    });
    this.unsubscribers.push(unsubscribe);
  }

  private hooks() {
    return {
      executeCommand: async (command: {
        readonly type: string;
      } & Record<string, unknown>) => {
        if (!this.buses.command) throw new Error('Command bus not configured');
        return this.buses.command(command);
      },
      publishEvent: async (event: { type: string; payload: unknown }) => {
        if (!this.buses.event) throw new Error('Event bus not configured');
        return this.buses.event(event);
      },
      runWorkflow: async (workflowId: string, payload?: unknown) => {
        if (!this.buses.runWorkflow) throw new Error('Workflow engine not configured');
        return this.buses.runWorkflow(workflowId, payload);
      },
    };
  }

  private seedDefaultActions(): void {
    const buses = this.buses;
    this.actions.register('workflow', async ({ workflowId }, _ctx, hooks) =>
      hooks.runWorkflow(workflowId),
    );
    this.actions.register('command', async ({ command }, context) => {
      if (!buses.command) throw new Error('Command bus not available');
      return buses.command(await command(context.payload));
    });
    this.actions.register('event', async ({ event }, context) => {
      if (!buses.event) throw new Error('Event bus not available');
      return buses.event(await event(context.payload));
    });
    this.actions.register('log', async ({ level, message }, context) => {
      const logger = this.logger;
      if (logger) logger[level](message(context.payload));
      return undefined;
    });
    this.actions.register('notify', () => {
      throw new Error('Notify action requires the notification engine to be wired');
    });
    this.actions.register('plugin', () => {
      throw new Error('Plugin action execution requires the plugin registry to be wired');
    });
  }
}

/** Public interface of the Automation Engine. */
export interface AutomationEngine {
  readonly registry: AutomationRegistry;
  readonly actions: AutomationActionRegistry;
  register: (rule: AutomationRule) => boolean;
  has: (id: string) => boolean;
  get: (id: string) => AutomationRule | undefined;
  record: (id: string) => AutomationRecord | undefined;
  evaluateEvent: (event: string, payload: unknown) => Promise<AutomationEvaluation[]>;
  evaluateSchedules: (at?: Date) => Promise<AutomationEvaluation[]>;
  manual: (id: string, payload?: unknown) => Promise<AutomationEvaluation>;
  dispose: () => void;
  snapshot: () => AutomationEngineSnapshot;
}

/** Create an automation engine with default registries + buses. */
export function createAutomationEngine(options: AutomationEngineOptions = {}): AutomationEngine {
  return new AutomationEngineImp(options);
}

export type { AutomationRule, AutomationEvaluation, AutomationActionResult, AutomationRecord };