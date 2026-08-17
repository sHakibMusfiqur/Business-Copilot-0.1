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
    
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      const failedTask = (error as { failedTask?: string }).failedTask;
      this.logger.error(`Dispatch failed for ${sessionId}: ${message}`);
      return { success: false, error: message, ...(failedTask ? { failedTask } : {}) };
    }
  }
}
