import type { PluginStatus } from './types';

/** Valid plugin lifecycle transitions (kept strict). */
const VALID_TRANSITIONS: Record<PluginStatus, readonly PluginStatus[]> = {
  registered: ['resolving', 'uninstalled', 'failed'],
  resolving: ['initializing', 'failed'],
  initializing: ['active', 'inactive', 'failed'],
  active: ['inactive', 'uninstalled', 'failed'],
  inactive: ['active', 'uninstalled', 'failed'],
  failed: ['registered', 'uninstalled'],
  uninstalled: [],
};

/** Strict plugin lifecycle state machine. */
export class PluginLifecycle {
  private status: PluginStatus = 'registered';

  get value(): PluginStatus {
    return this.status;
  }

  is(status: PluginStatus): boolean {
    return this.status === status;
  }

  canTransition(next: PluginStatus): boolean {
    return VALID_TRANSITIONS[this.status].includes(next);
  }

  transition(next: PluginStatus): PluginStatus {
    if (!this.canTransition(next)) {
      throw new Error(`Invalid plugin lifecycle transition: ${this.status} -> ${next}`);
    }
    this.status = next;
    return this.status;
  }

  /** Force a status (used for host-level resets); keeps validation strict. */
  force(status: PluginStatus): void {
    this.status = status;
  }
}