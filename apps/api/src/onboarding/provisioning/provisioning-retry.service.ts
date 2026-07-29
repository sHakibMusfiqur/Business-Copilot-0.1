import { Injectable, Logger } from '@nestjs/common';
import { OnboardingMetricsService } from '../services/onboarding-metrics.service';
import { isTransientError } from './retry-policy';

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

@Injectable()
export class ProvisioningRetryService {
  private readonly logger = new Logger(ProvisioningRetryService.name);

  constructor(
    private readonly metricsService: OnboardingMetricsService,
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    retryData: { retryCount: number; lastFailedTask: string | null; sessionId?: string },
    config: RetryConfig = DEFAULT_CONFIG,
  ): Promise<{ result: T; retryCount: number }> {
    let lastError: Error | null = null;
    let retryCount = retryData.retryCount;

    while (retryCount <= config.maxRetries) {
      try {
        const result = await operation();
        return { result, retryCount };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retryCount++;

        if (!isTransientError(lastError)) {
          this.logger.warn(`Non-transient error, not retrying: ${lastError.message}`);
          throw lastError;
        }

        this.metricsService.recordRetry(retryData.sessionId ?? 'unknown');

        if (retryCount > config.maxRetries) {
          this.logger.error(`Retry exhausted after ${retryCount} attempts: ${lastError.message}`);
          throw lastError;
        }

        const delay = Math.min(
          config.baseDelayMs * Math.pow(2, retryCount - 1),
          config.maxDelayMs,
        );
        this.logger.warn(`Retry ${retryCount}/${config.maxRetries} in ${delay}ms: ${lastError.message}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError ?? new Error('Retry failed');
  }
}
