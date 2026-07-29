import { Injectable } from '@nestjs/common';
import { Subject, type Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import type { ProvisionEventBus, ProvisioningEvent } from './provision-event-bus.interface';

@Injectable()
export class LocalEventBus implements ProvisionEventBus {
  private readonly eventSubject = new Subject<ProvisioningEvent>();

  publish(event: ProvisioningEvent): void {
    this.eventSubject.next(event);
  }

  subscribe(sessionId: string, callback: (event: ProvisioningEvent) => void): () => void {
    const subscription = this.eventSubject
      .pipe(filter((e) => e.sessionId === sessionId))
      .subscribe(callback);
    return () => subscription.unsubscribe();
  }

  getStream(sessionId: string): Observable<ProvisioningEvent> {
    return this.eventSubject.asObservable().pipe(
      filter((event) => event.sessionId === sessionId),
    );
  }
}
