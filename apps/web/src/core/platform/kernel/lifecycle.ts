import type { PlatformPhase } from './types';

const VALID_TRANSITIONS: Record<PlatformPhase, readonly PlatformPhase[]> = {
  uninitialized: ['booting', 'failed'],
  booting: ['ready', 'failed'],
  ready: ['failed', 'booting'],
  failed: ['booting'],
};

export class PlatformLifecycle {
  private current: PlatformPhase = 'uninitialized';

  get phase(): PlatformPhase {
    return this.current;
  }

  is(phase: PlatformPhase): boolean {
    return this.current === phase;
  }

  isReady(): boolean {
    return this.current === 'ready';
  }

  transition(next: PlatformPhase): PlatformPhase {
    const allowed = VALID_TRANSITIONS[this.current];
    if (!allowed.includes(next)) {
      throw new Error(`Invalid platform lifecycle transition: ${this.current} -> ${next}`);
    }
    this.current = next;
    return this.current;
  }

  reset(): void {
    this.current = 'uninitialized';
  }
}
