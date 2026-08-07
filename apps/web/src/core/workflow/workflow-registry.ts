import type {
  WorkflowDefinition,
  WorkflowRecord,
  WorkflowStatus,
  WorkflowTriggerKind,
} from './types';

/** Result of a workflow-definition validation run. */
export interface WorkflowValidationReport {
  readonly ok: boolean;
  readonly duplicateIds: readonly string[];
  readonly missingStepIds: readonly string[];
  readonly duplicateStepIds: readonly string[];
  readonly unknownStepKinds: readonly string[];
  readonly unknownTriggerKinds: readonly string[];
  readonly missingSubflowTargets: readonly string[];
  readonly errors: readonly string[];
}

/** Human-readable validation failures for a definition. */
export interface WorkflowValidation {
  readonly ok: boolean;
  readonly reasons: readonly string[];
}

/**
 * Kinds accepted during validation. When supplied (e.g. from a live
 * {@link WorkflowStepRegistry} / {@link WorkflowTriggerRegistry}), plugins may
 * extend the accepted set; when omitted the built-in catalogue is used.
 */
export interface WorkflowValidationDeps {
  readonly stepKinds: readonly string[];
  readonly triggerKinds: readonly string[];
}

/** Built-in step kinds (extension points for {@link WorkflowStepRegistry}). */
export const BUILT_IN_STEP_KINDS = [
  'task',
  'command',
  'query',
  'condition',
  'wait',
  'subflow',
  'emit',
  'plugin',
] as const;

/** Built-in trigger kinds (extension points for {@link WorkflowTriggerRegistry}). */
export const BUILT_IN_TRIGGER_KINDS = ['manual', 'event', 'schedule'] as const;


export class WorkflowRegistry {
  private readonly byId = new Map<string, WorkflowDefinition>();

  /** Register a definition. Returns false on id collision. */
  register(definition: WorkflowDefinition): boolean {
    if (this.byId.has(definition.id)) return false;
    this.byId.set(definition.id, definition);
    return true;
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  get(id: string): WorkflowDefinition | undefined {
    return this.byId.get(id);
  }

  remove(id: string): boolean {
    return this.byId.delete(id);
  }

  all(): readonly WorkflowDefinition[] {
    return [...this.byId.values()];
  }

  /** Public, implementation-free record of a registered workflow. */
  record(id: string): WorkflowRecord | undefined {
    const definition = this.byId.get(id);
    if (!definition) return undefined;
    const triggerKinds = [
      ...new Set(definition.triggers.map((trigger) => trigger.type)),
    ] as WorkflowTriggerKind[];
    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      category: definition.category,
      status: (definition.status ?? 'draft') as WorkflowStatus,
      enabled: definition.enabled ?? true,
      stepCount: definition.steps.length,
      triggerCount: definition.triggers.length,
      triggerKinds,
    };
  }

  
  validate(
    definitions: readonly WorkflowDefinition[],
    deps?: Partial<WorkflowValidationDeps>,
  ): WorkflowValidationReport {
    const duplicateIds = new Set<string>();
    const seen = new Set<string>();
    for (const definition of definitions) {
      if (seen.has(definition.id)) duplicateIds.add(definition.id);
      seen.add(definition.id);
    }

    const knownStepKinds = new Set<string>(deps?.stepKinds ?? BUILT_IN_STEP_KINDS);
    const knownTriggerKinds = new Set<string>(deps?.triggerKinds ?? BUILT_IN_TRIGGER_KINDS);
    const missingStepIds = new Set<string>();
    const duplicateStepIds = new Set<string>();
    const unknownStepKinds = new Set<string>();
    const unknownTriggerKinds = new Set<string>();
    const missingSubflowTargets = new Set<string>();

    for (const definition of definitions) {
      const stepIds = new Set<string>();
      for (const step of definition.steps) {
        if (!step.id) missingStepIds.add(definition.id);
        if (stepIds.has(step.id)) duplicateStepIds.add(definition.id);
        stepIds.add(step.id);
        if (!knownStepKinds.has(step.kind)) unknownStepKinds.add(step.kind);
        if (step.kind === 'subflow' && !this.byId.has(step.workflowId) && !seen.has(step.workflowId)) {
          missingSubflowTargets.add(step.workflowId);
        }
      }
      for (const trigger of definition.triggers) {
        if (!knownTriggerKinds.has(trigger.type)) unknownTriggerKinds.add(trigger.type);
      }
    }

    return {
      ok:
        duplicateIds.size === 0 &&
        missingStepIds.size === 0 &&
        duplicateStepIds.size === 0 &&
        unknownStepKinds.size === 0 &&
        unknownTriggerKinds.size === 0 &&
        missingSubflowTargets.size === 0,
      duplicateIds: [...duplicateIds],
      missingStepIds: [...missingStepIds],
      duplicateStepIds: [...duplicateStepIds],
      unknownStepKinds: [...unknownStepKinds],
      unknownTriggerKinds: [...unknownTriggerKinds],
      missingSubflowTargets: [...missingSubflowTargets],
      errors: compactValidationErrors({
        duplicateIds: [...duplicateIds],
        missingStepIds: [...missingStepIds],
        duplicateStepIds: [...duplicateStepIds],
        unknownStepKinds: [...unknownStepKinds],
        unknownTriggerKinds: [...unknownTriggerKinds],
        missingSubflowTargets: [...missingSubflowTargets],
      }),
    };
  }

  /** Validate a single definition. */
  validateOne(
    definition: WorkflowDefinition,
    deps?: Partial<WorkflowValidationDeps>,
  ): WorkflowValidation {
    const report = this.validate([definition], deps);
    return { ok: report.ok, reasons: report.errors };
  }
}

function compactValidationErrors(report: {
  duplicateIds: readonly string[];
  missingStepIds: readonly string[];
  duplicateStepIds: readonly string[];
  unknownStepKinds: readonly string[];
  unknownTriggerKinds: readonly string[];
  missingSubflowTargets: readonly string[];
}): string[] {
  const parts: string[] = [];
  if (report.duplicateIds.length) parts.push(`duplicate workflow ids: ${report.duplicateIds.join(', ')}`);
  if (report.missingStepIds.length) parts.push(`steps without ids: ${report.missingStepIds.join(', ')}`);
  if (report.duplicateStepIds.length) parts.push(`duplicate step ids in: ${report.duplicateStepIds.join(', ')}`);
  if (report.unknownStepKinds.length) parts.push(`unknown step kinds: ${report.unknownStepKinds.join(', ')}`);
  if (report.unknownTriggerKinds.length) parts.push(`unknown trigger kinds: ${report.unknownTriggerKinds.join(', ')}`);
  if (report.missingSubflowTargets.length) parts.push(`missing subflow targets: ${report.missingSubflowTargets.join(', ')}`);
  return parts;
}

/** Create a new, empty workflow registry. */
export function createWorkflowRegistry(): WorkflowRegistry {
  return new WorkflowRegistry();
}