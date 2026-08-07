/** Status of a registered automation rule. */
export type AutomationStatus = 'draft' | 'active' | 'paused' | 'archived';

/** The class of trigger an automation can react to. */
export type AutomationTriggerKind = 'event' | 'schedule' | 'manual';

/** The kind of action an automation can perform. */
export type AutomationActionKind =
  | 'notify'
  | 'workflow'
  | 'command'
  | 'event'
  | 'log'
  | 'plugin';

/** Discriminated automation trigger. */
export interface AutomationEventTrigger {
  readonly type: 'event';
  readonly event: string;
  readonly match?: (payload: unknown) => boolean;
}

export interface AutomationScheduleTrigger {
  readonly type: 'schedule';
  readonly cron?: string;
  readonly seconds?: number;
}

export interface AutomationManualTrigger {
  readonly type: 'manual';
  readonly label?: string;
}

export type AutomationTrigger =
  | AutomationEventTrigger
  | AutomationScheduleTrigger
  | AutomationManualTrigger;

/** Discriminated automation action. */
export interface AutomationNotifyAction {
  readonly type: 'notify';
  readonly channel: string;
  readonly template: string;
  /** Renders a payload for the template from the event payload. */
  readonly fields?: (payload: unknown) => Readonly<Record<string, unknown>>;
}

export interface AutomationWorkflowAction {
  readonly type: 'workflow';
  readonly workflowId: string;
}

export interface AutomationCommandAction {
  readonly type: 'command';
  readonly command: (payload: unknown) =>
    | { readonly type: string } & Record<string, unknown>
    | Promise<{ readonly type: string } & Record<string, unknown>>;
}

export interface AutomationEventAction {
  readonly type: 'event';
  readonly event: (payload: unknown) => { type: string; payload: unknown } | Promise<{ type: string; payload: unknown }>;
}

export interface AutomationLogAction {
  readonly type: 'log';
  readonly level: 'info' | 'warn' | 'error';
  readonly message: (payload: unknown) => string;
}

export interface AutomationPluginAction {
  readonly type: 'plugin';
  readonly pluginId: string;
  readonly input?: (payload: unknown) => unknown;
}

export type AutomationAction =
  | AutomationNotifyAction
  | AutomationWorkflowAction
  | AutomationCommandAction
  | AutomationEventAction
  | AutomationLogAction
  | AutomationPluginAction;

/** A declarative automation rule, ready to register. */
export interface AutomationRule {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly status?: AutomationStatus;
  readonly enabled?: boolean;
  readonly trigger: AutomationTrigger;
  readonly actions: readonly AutomationAction[];
}

/** Runtime context handed to action executors. */
export interface AutomationContext {
  readonly rule: AutomationRule;
  /** The raw event/schedule/manual payload that triggered the rule. */
  readonly payload: unknown;
  readonly triggeredAt: string;
}

/** Outcome of executing one action. */
export interface AutomationActionResult {
  readonly ruleId: string;
  readonly actionIndex: number;
  readonly action: AutomationAction;
  readonly ok: boolean;
  readonly error?: string;
  readonly elapsedMs: number;
}

/** Outcome of a single rule evaluation. */
export interface AutomationEvaluation {
  readonly ruleId: string;
  readonly matched: boolean;
  readonly results: readonly AutomationActionResult[];
}

/** Public view of a registered automation rule. */
export interface AutomationRecord {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly status: AutomationStatus;
  readonly enabled: boolean;
  readonly triggerKind: AutomationTriggerKind;
  readonly actionCount: number;
  readonly actionKinds: readonly AutomationActionKind[];
}

/** Immutable snapshot of the automation engine. */
export interface AutomationEngineSnapshot {
  readonly ruleCount: number;
  readonly activeCount: number;
  readonly evaluationCount: number;
  readonly failedActionCount: number;
  readonly records: readonly AutomationRecord[];
}