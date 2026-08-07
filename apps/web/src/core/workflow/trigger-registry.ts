import type { WorkflowTrigger, WorkflowTriggerKind } from './types';

/** A concrete signal the engine can evaluate a trigger against. */
export type WorkflowTriggerSignal =
  | { readonly kind: 'manual'; readonly payload: unknown }
  | { readonly kind: 'event'; readonly event: string; readonly payload: unknown }
  | { readonly kind: 'schedule'; readonly at: Date };

/** Evaluates a trigger against a signal; returns true when it fires. */
export type TriggerEvaluator = (
  trigger: WorkflowTrigger,
  signal: WorkflowTriggerSignal,
) => boolean;

/** Public view of a registered trigger evaluator. */
export interface TriggerEvaluatorRecord {
  readonly kind: WorkflowTriggerKind;
  readonly evaluate: TriggerEvaluator;
}


export class WorkflowTriggerRegistry {
  private readonly byKind = new Map<WorkflowTriggerKind, TriggerEvaluator>();

  /** Register (or overwrite) an evaluator for a trigger kind. */
  register(kind: WorkflowTriggerKind, evaluate: TriggerEvaluator): this {
    this.byKind.set(kind, evaluate);
    return this;
  }

  has(kind: string): boolean {
    return this.byKind.has(kind as WorkflowTriggerKind);
  }

  /** Evaluate a trigger against a signal. Unknown kinds never fire. */
  evaluate(trigger: WorkflowTrigger, signal: WorkflowTriggerSignal): boolean {
    const evaluator = this.byKind.get(trigger.type);
    if (!evaluator) return false;
    return evaluator(trigger, signal);
  }

  /** List every registered evaluator (for validation and snapshots). */
  list(): readonly TriggerEvaluatorRecord[] {
    return [...this.byKind.entries()].map(([kind, evaluate]) => ({ kind, evaluate }));
  }

  kinds(): readonly WorkflowTriggerKind[] {
    return [...this.byKind.keys()];
  }
}

/** Create a new, empty trigger registry. */
export function createTriggerRegistry(): WorkflowTriggerRegistry {
  return new WorkflowTriggerRegistry();
}