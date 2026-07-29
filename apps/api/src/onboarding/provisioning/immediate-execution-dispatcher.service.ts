import { Injectable, Logger } from '@nestjs/common';
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
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Dispatch failed for ${sessionId}: ${message}`);
      return { success: false, error: message };
    }
  }
}
