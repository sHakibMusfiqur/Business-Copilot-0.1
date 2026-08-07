import type { ModuleLifecycleStatus } from './types';

/** Allowed lifecycle transitions for a module instance. */
const VALID_TRANSITIONS: Record<ModuleLifecycleStatus, readonly ModuleLifecycleStatus[]> = {
  registered: ['resolving', 'failed'],
  resolving: ['loaded', 'failed'],
  loaded: ['starting', 'stopped', 'failed'],
  starting: ['active', 'stopped', 'failed'],
  active: ['stopping', 'failed'],
  stopping: ['stopped', 'failed'],
  stopped: ['starting', 'registered', 'failed'],
  failed: ['registered'],
};

/** Strict module lifecycle state machine. */
export class ModuleLifecycle {
  private status: ModuleLifecycleStatus = 'registered';

  get value(): ModuleLifecycleStatus {
    return this.status;
  }

  is(status: ModuleLifecycleStatus): boolean {
    return this.status === status;
  }

  canTransition(next: ModuleLifecycleStatus): boolean {
    return VALID_TRANSITIONS[this.status].includes(next);
  }

  transition(next: ModuleLifecycleStatus): ModuleLifecycleStatus {
    if (!this.canTransition(next)) {
      throw new Error(`Invalid module lifecycle transition: ${this.status} -> ${next}`);
    }
    this.status = next;
    return this.status;
  }

  /** Force a status (used at host teardown / failure recovery). */
  force(status: ModuleLifecycleStatus): void {
    this.status = status;
  }
}