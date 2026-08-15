import { Injectable, Logger, HttpException } from '@nestjs/common';
import type { ProvisionDispatcher, DispatchResult } from './provision-dispatcher.interface';
import { ProvisioningOrchestratorService } from './provisioning-orchestrator.service';

@Injectable()
export class ImmediateExecutionDispatcher implements ProvisionDispatcher {
  private readonly logger = new Logger(ImmediateExecutionDispatcher.name);

  constructor(
    private readonly orchestrator: ProvisioningOrchestratorService,
  ) {}

  async dispatch(sessionId: string): Promise<DispatchResult> {
    try {
      const result = await this.orchestrator.orchestrate(sessionId);
      return { success: true, result };
    } catch (error) {
      // Domain rejections (e.g. a ConflictException for a second organization
      // or a taken name) must reach the caller as their real status code, not
      // as a generic 500. Only infrastructure/transient failures are folded
      // into a DispatchResult for the engine to record and rethrow.
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Dispatch failed for ${sessionId}: ${message}`);
      return { success: false, error: message };
    }
  }
}
