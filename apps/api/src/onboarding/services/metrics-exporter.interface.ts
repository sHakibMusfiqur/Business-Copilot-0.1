export interface OnboardingMetrics {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  failedSessions: number;
  provisioningDurationMs: { avg: number; p50: number; p95: number; p99: number };
  retryCounts: { total: number; bySessionId: Record<string, number> };
  sessionDurationsMs: number[];
}

export abstract class MetricsExporter {
  abstract readonly name: string;
  abstract push(metrics: OnboardingMetrics): Promise<void>;
}
