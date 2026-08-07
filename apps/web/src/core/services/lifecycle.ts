import type { ServiceStatus } from './types';

const VALID_TRANSITIONS: Record<ServiceStatus, readonly ServiceStatus[]> = {
  registered: ['initializing', 'disabled', 'deprecated'],
  initializing: ['ready', 'failed'],
  ready: ['failed', 'disabled', 'deprecated'],
  failed: ['registered'],
  disabled: ['registered'],
  deprecated: ['ready'],
};

export class ServiceLifecycle {
  private status: ServiceStatus = 'registered';

  get value(): ServiceStatus {
    return this.status;
  }

  is(status: ServiceStatus): boolean {
    return this.status === status;
  }

  canTransition(next: ServiceStatus): boolean {
    return VALID_TRANSITIONS[this.status].includes(next);
  }

  transition(next: ServiceStatus): ServiceStatus {
    if (!this.canTransition(next)) {
      throw new Error(`Invalid service lifecycle transition: ${this.status} -> ${next}`);
    }
    this.status = next;
    return this.status;
  }

  /** Force a status for services that are prebuilt at registration. */
  force(status: ServiceStatus): void {
    this.status = status;
  }

  reset(): void {
    this.status = 'registered';
  }
}