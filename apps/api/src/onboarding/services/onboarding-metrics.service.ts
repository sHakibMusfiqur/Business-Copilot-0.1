import { Injectable } from '@nestjs/common';
import { MetricsExporter, type OnboardingMetrics } from './metrics-exporter.interface';
import { MemoryExporter } from './memory-exporter.service';

@Injectable()
export class OnboardingMetricsService {
  private sessionStartTimes = new Map<string, number>();
  private completedSessions = 0;
  private failedSessions = 0;
  private activeSessions = 0;
  private sessionDurations: number[] = [];
  private retriesBySession = new Map<string, number>();
  private totalRetries = 0;
  private exporters: MetricsExporter[] = [];

  constructor(memoryExporter: MemoryExporter) {
    this.exporters.push(memoryExporter);
  }

  addExporter(exporter: MetricsExporter): void {
    this.exporters.push(exporter);
  }

  recordSessionStart(sessionId: string): void {
    this.sessionStartTimes.set(sessionId, Date.now());
    this.activeSessions++;
  }

  recordSessionComplete(sessionId: string): void {
    const start = this.sessionStartTimes.get(sessionId);
    if (start) {
      const duration = Date.now() - start;
      this.sessionDurations.push(duration);
      this.sessionStartTimes.delete(sessionId);
    }
    this.completedSessions++;
    this.activeSessions = Math.max(0, this.activeSessions - 1);
  }

  recordSessionFailed(sessionId: string): void {
    const start = this.sessionStartTimes.get(sessionId);
    if (start) {
      const duration = Date.now() - start;
      this.sessionDurations.push(duration);
      this.sessionStartTimes.delete(sessionId);
    }
    this.failedSessions++;
    this.activeSessions = Math.max(0, this.activeSessions - 1);
  }

  recordRetry(sessionId: string): void {
    this.totalRetries++;
    this.retriesBySession.set(sessionId, (this.retriesBySession.get(sessionId) ?? 0) + 1);
  }

  getMetrics(): OnboardingMetrics {
    const sorted = [...this.sessionDurations].sort((a, b) => a - b);
    const len = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      totalSessions: this.completedSessions + this.failedSessions + this.activeSessions,
      activeSessions: this.activeSessions,
      completedSessions: this.completedSessions,
      failedSessions: this.failedSessions,
      provisioningDurationMs: {
        avg: len > 0 ? Math.round(sum / len) : 0,
        p50: len > 0 ? sorted[Math.floor(len * 0.5)] : 0,
        p95: len > 0 ? sorted[Math.floor(len * 0.95)] : 0,
        p99: len > 0 ? sorted[Math.floor(len * 0.99)] : 0,
      },
      retryCounts: {
        total: this.totalRetries,
        bySessionId: Object.fromEntries(this.retriesBySession),
      },
      sessionDurationsMs: this.sessionDurations,
    };
  }

  async pushMetrics(): Promise<void> {
    const metrics = this.getMetrics();
    await Promise.all(this.exporters.map((e) => e.push(metrics)));
  }

  reset(): void {
    this.sessionStartTimes.clear();
    this.completedSessions = 0;
    this.failedSessions = 0;
    this.activeSessions = 0;
    this.sessionDurations = [];
    this.retriesBySession.clear();
    this.totalRetries = 0;
  }
}
