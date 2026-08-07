import type {
  AutomationActionKind,
  AutomationRecord,
  AutomationRule,
  AutomationStatus,
  AutomationTriggerKind,
} from './types';

/** Result of an automation-rule validation run. */
export interface AutomationValidationReport {
  readonly ok: boolean;
  readonly duplicateIds: readonly string[];
  readonly unknownActionKinds: readonly string[];
  readonly missingWorkflowTargets: readonly string[];
  readonly errors: readonly string[];
}

/** Public view of an individual rule's validation. */
export interface AutomationValidation {
  readonly ok: boolean;
  readonly reasons: readonly string[];
}


export interface AutomationValidationDeps {
  readonly actionKinds: readonly string[];
}

/** Built-in action kinds (extension points for {@link AutomationActionRegistry}). */
export const BUILT_IN_ACTION_KINDS = [
  'workflow',
  'command',
  'event',
  'log',
  'notify',
  'plugin',
] as const;


export class AutomationRegistry {
  private readonly byId = new Map<string, AutomationRule>();

  /** Register a rule. Returns false on id collision. */
  register(rule: AutomationRule): boolean {
    if (this.byId.has(rule.id)) return false;
    this.byId.set(rule.id, rule);
    return true;
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  get(id: string): AutomationRule | undefined {
    return this.byId.get(id);
  }

  remove(id: string): boolean {
    return this.byId.delete(id);
  }

  all(): readonly AutomationRule[] {
    return [...this.byId.values()];
  }

  /** Public, implementation-free record of a registered rule. */
  record(id: string): AutomationRecord | undefined {
    const rule = this.byId.get(id);
    if (!rule) return undefined;
    const actionKinds = [
      ...new Set(rule.actions.map((action) => action.type)),
    ] as AutomationActionKind[];
    return {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      status: (rule.status ?? 'draft') as AutomationStatus,
      enabled: rule.enabled ?? true,
      triggerKind: rule.trigger.type as AutomationTriggerKind,
      actionCount: rule.actions.length,
      actionKinds,
    };
  }

 
  validate(
    rules: readonly AutomationRule[],
    deps?: Partial<AutomationValidationDeps>,
  ): AutomationValidationReport {
    const duplicateIds = new Set<string>();
    const seen = new Set<string>();
    for (const rule of rules) {
      if (seen.has(rule.id)) duplicateIds.add(rule.id);
      seen.add(rule.id);
    }

    const knownActions = new Set<string>(deps?.actionKinds ?? BUILT_IN_ACTION_KINDS);
    const unknownActionKinds = new Set<string>();
    const missingWorkflowTargets = new Set<string>();
    for (const rule of rules) {
      for (const action of rule.actions) {
        if (!knownActions.has(action.type)) unknownActionKinds.add(action.type);
        if (action.type === 'workflow' && !this.byId.has(action.workflowId) && !seen.has(action.workflowId)) {
          missingWorkflowTargets.add(action.workflowId);
        }
      }
    }

    const errors: string[] = [];
    if (duplicateIds.size > 0) errors.push(`duplicate rule ids: ${[...duplicateIds].join(', ')}`);
    if (unknownActionKinds.size > 0) errors.push(`unknown action kinds: ${[...unknownActionKinds].join(', ')}`);
    if (missingWorkflowTargets.size > 0) errors.push(`missing workflow targets: ${[...missingWorkflowTargets].join(', ')}`);

    return {
      ok: duplicateIds.size === 0 && unknownActionKinds.size === 0 && missingWorkflowTargets.size === 0,
      duplicateIds: [...duplicateIds],
      unknownActionKinds: [...unknownActionKinds],
      missingWorkflowTargets: [...missingWorkflowTargets],
      errors,
    };
  }

  /** Validate a single rule. */
  validateOne(
    rule: AutomationRule,
    deps?: Partial<AutomationValidationDeps>,
  ): AutomationValidation {
    const report = this.validate([rule], deps);
    return { ok: report.ok, reasons: report.errors };
  }
}

/** Create a new, empty automation registry. */
export function createAutomationRegistry(): AutomationRegistry {
  return new AutomationRegistry();
}