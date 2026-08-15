import { Injectable, Logger, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { IndustryTemplateFactory } from '../industry-templates/industry-template.factory';
import { ProvisioningExecutorService, type ProvisionResult } from './provisioning-executor.service';
import { ProvisioningRetryService } from './provisioning-retry.service';
import { PROVISION_EVENT_BUS, type ProvisionEventBus } from './provision-event-bus.interface';
import type { ProvisioningConfig } from '../industry-templates/types';
import type { ProvisioningContext } from '../industry-templates/industry-template-provider.interface';

const CHECKPOINT_TASKS = [
  { checkpoint: 1, task: 'Creating organization...', progress: 5 },
  { checkpoint: 2, task: 'Assigning owner...', progress: 15 },
  { checkpoint: 3, task: 'Creating owner role...', progress: 30 },
  { checkpoint: 4, task: 'Configuring departments...', progress: 45 },
  { checkpoint: 5, task: 'Setting up subscription...', progress: 65 },
  { checkpoint: 6, task: 'Applying industry settings...', progress: 85 },
  { checkpoint: 7, task: 'Industry lifecycle...', progress: 95 },
];

@Injectable()
export class ProvisioningOrchestratorService {
  private readonly logger = new Logger(ProvisioningOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly executorService: ProvisioningExecutorService,
    @Inject(PROVISION_EVENT_BUS) private readonly eventBus: ProvisionEventBus,
    private readonly retryService: ProvisioningRetryService,
    private readonly industryFactory: IndustryTemplateFactory,
  ) {}

  async orchestrate(sessionId: string): Promise<ProvisionResult> {
    const session = await this.prisma.onboardingSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session not found');

    const config = this.industryFactory.getProvisioningConfig(session.selectedIndustry as string);
    if (!config) throw new BadRequestException('Invalid industry');

    await this.auditService.record({
      action: 'PROVISION_STARTED',
      status: 'SUCCESS',
      entity: 'OnboardingSession',
      entityId: sessionId,
      metadata: { email: session.email, industry: session.selectedIndustry },
    });

    this.eventBus.publish({
      sessionId,
      type: 'started',
      data: { progress: 0, currentTask: 'Starting...', completedTasks: [] },
    });

    const provider = this.industryFactory.getProvider(session.selectedIndustry as string);
    const context: ProvisioningContext = {
      sessionId: session.id,
      userId: session.userId ?? undefined,
      orgName: session.orgName ?? '',
      orgEmail: session.orgEmail ?? undefined,
      selectedIndustry: session.selectedIndustry ?? '',
      selectedModules: (session.selectedModules as string[]) ?? [],
      businessProfile: session.businessProfile as Record<string, unknown> | undefined,
    };

    if (provider?.validate) {
      await provider.validate(context);
    }

    const { result: provisionResult } = await this.retryService.execute(
      () => this.executeProvisioningInTransaction(sessionId, session, config, context),
      { retryCount: 0, lastFailedTask: null, sessionId },
    );

    await this.auditService.record({
      action: 'PROVISION_COMPLETED',
      status: 'SUCCESS',
      entity: 'OnboardingSession',
      entityId: sessionId,
      metadata: { email: session.email, organizationId: provisionResult.org.id },
    });

    this.eventBus.publish({
      sessionId,
      type: 'completed',
      data: {
        progress: 100,
        currentTask: 'Complete',
        completedTasks: ['Organization', 'Owner', 'Roles', 'Departments', 'Subscription', 'Settings', 'Industry'],
      },
    });

    if (provider?.postProvision) {
      await (provider.postProvision(context, provisionResult.org.id) as Promise<void>).catch(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (err: any) => {
          this.logger.warn(`postProvision failed for ${sessionId}: ${err.message}`);
        },
      );
    }

    return provisionResult;
  }

  private async executeProvisioningInTransaction(
    sessionId: string,
    session: Record<string, unknown>,
    config: ProvisioningConfig,
    _context: ProvisioningContext,
  ): Promise<ProvisionResult> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.prisma.$transaction(async (tx: any) => {
      const provisionData = (session.provisionData as Record<string, unknown>) ?? {};
      const failedTask = provisionData.failedTask as string | null;
      const startCheckpoint = failedTask
        ? CHECKPOINT_TASKS.findIndex((c) => c.task === failedTask) + 1
        : 1;

      const checkpointResult = await this.executorService.executeCheckpoint(
        session, config, startCheckpoint, tx,
      );

      const result = checkpointResult.result ?? await this.buildProvisionResult(tx, session);

      CHECKPOINT_TASKS.forEach((c) => {
        this.eventBus.publish({
          sessionId,
          type: 'progress',
          data: {
            progress: c.progress,
            currentTask: c.task,
            completedTasks: checkpointResult.tasks,
            failedTask: null,
          },
        });
      });

      return result;
    });
  }

  private async buildProvisionResult(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    session: Record<string, unknown>,
  ): Promise<ProvisionResult> {
    if (!session.organizationId) {
      throw new Error('Organization not created during transaction');
    }
    const org = await tx.organization.findUnique({
      where: { id: session.organizationId as string },
    });
    if (!org) throw new Error('Organization not created during transaction');
    const sub = await tx.subscription.findUnique({ where: { organizationId: org.id } });
    return { org, subscription: sub ?? null };
  }
}
