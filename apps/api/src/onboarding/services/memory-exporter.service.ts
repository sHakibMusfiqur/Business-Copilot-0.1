import { Injectable, Logger } from '@nestjs/common';
import { MetricsExporter, type OnboardingMetrics } from './metrics-exporter.interface';

@Injectable()
export class MemoryExporter extends MetricsExporter {
  readonly name = 'memory';
  private readonly logger = new Logger(MemoryExporter.name);

  async push(metrics: OnboardingMetrics): Promise<void> {
    this.logger.debug(`MemoryExporter: ${metrics.totalSessions} total, ${metrics.completedSessions} completed`);
  }
}
