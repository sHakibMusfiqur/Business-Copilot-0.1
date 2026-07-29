import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';

interface CompensationAction {
  name: string;
  execute: () => Promise<void>;
}

@Injectable()
export class CompensationManager {
  private readonly logger = new Logger(CompensationManager.name);
  private readonly actions: CompensationAction[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  register(name: string, execute: () => Promise<void>): void {
    this.actions.push({ name, execute });
  }

  async rollback(sessionId: string): Promise<void> {
    this.logger.warn(`Rolling back provisioning for session ${sessionId}`);

    await this.auditService.record({
      action: 'ROLLBACK_STARTED',
      status: 'SUCCESS',
      entity: 'OnboardingSession',
      entityId: sessionId,
    });

    const errors: string[] = [];

    for (const action of this.actions.reverse()) {
      try {
        await action.execute();
        this.logger.log(`Compensation succeeded: ${action.name}`);
      } catch (error) {
        const msg = `Compensation failed for ${action.name}: ${(error as Error).message}`;
        this.logger.error(msg);
        errors.push(msg);
      }
    }

    await this.prisma.onboardingSession.update({
      where: { id: sessionId },
      data: {
        provisionStatus: 'FAILED',
        provisionData: {
          rolledBack: true,
          rollbackErrors: errors.length > 0 ? errors : undefined,
          rolledBackAt: new Date().toISOString(),
        },
      },
    });

    if (errors.length > 0) {
      await this.auditService.record({
        action: 'ROLLBACK_FAILED',
        status: 'FAILURE',
        entity: 'OnboardingSession',
        entityId: sessionId,
        metadata: { errors },
      });
    } else {
      await this.auditService.record({
        action: 'ROLLBACK_COMPLETED',
        status: 'SUCCESS',
        entity: 'OnboardingSession',
        entityId: sessionId,
      });
    }

    this.actions.length = 0;
  }

  clear(): void {
    this.actions.length = 0;
  }
}
