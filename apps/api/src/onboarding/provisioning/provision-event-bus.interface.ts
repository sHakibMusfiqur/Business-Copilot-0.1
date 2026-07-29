import { Observable } from 'rxjs';

export interface ProvisioningEvent {
  sessionId: string;
  type: 'progress' | 'completed' | 'failed' | 'started';
  data: {
    progress: number;
    currentTask: string | null;
    completedTasks: string[];
    failedTask?: string | null;
    error?: string | null;
  };
}

export const PROVISION_EVENT_BUS = Symbol('PROVISION_EVENT_BUS');

export interface ProvisionEventBus {
  publish(event: ProvisioningEvent): void;
  subscribe(sessionId: string, callback: (event: ProvisioningEvent) => void): () => void;
  getStream(sessionId: string): Observable<ProvisioningEvent>;
}
