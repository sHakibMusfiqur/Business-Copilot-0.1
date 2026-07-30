import { Injectable, Logger, ConflictException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { IndustryTemplateFactory } from '../industry-templates/industry-template.factory';
import { ProvisioningProgressService } from './provisioning-progress.service';
import { CompensationManager } from './compensation-manager';
import { OnboardingChecklistService } from '../services/onboarding-checklist.service';
import { OnboardingMetricsService } from '../services/onboarding-metrics.service';
import { PROVISION_DISPATCHER, type ProvisionDispatcher } from './provision-dispatcher.interface';

@Injectable()
export class ProvisioningEngineService {
  private readonly logger = new Logger(ProvisioningEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Inject(PROVISION_DISPATCHER) private readonly dispatcher: ProvisionDispatcher,
    private readonly progressService: ProvisioningProgressService,
    private readonly metricsService: OnboardingMetricsService,
    private readonly compensationManager: CompensationManager,
    private readonly checklistService: OnboardingChecklistService,
    private readonly industryFactory: IndustryTemplateFactory,
  ) {}

  async provision(
    sessionId: string,
    input?: { selectedIndustry?: string | null; orgName?: string | null },
  ) {
    const session = await this.prisma.onboardingSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new BadRequestException('Session not found');

    const selectedIndustry = (session.selectedIndustry as string | null) ?? input?.selectedIndustry ?? null;
    const orgName = (session.orgName as string | null) ?? input?.orgName ?? null;

    if (
      (input?.selectedIndustry && !session.selectedIndustry) ||
      (input?.orgName && !session.orgName)
    ) {
      await this.prisma.onboardingSession.update({
        where: { id: sessionId },
        data: {
          ...(input?.selectedIndustry && !session.selectedIndustry ? { selectedIndustry: input.selectedIndustry } : {}),
          ...(input?.orgName && !session.orgName ? { orgName: input.orgName } : {}),
        },
      });
    }

    if (session.provisionStatus === 'COMPLETED') {
      return this.mapSession(session);
    }

    if (session.provisionStatus === 'PROVISIONING') {
      const progress = await this.progressService.getProgress(sessionId);
      if (!progress?.failedTask) {
        throw new ConflictException('Provisioning already in progress');
      }
      this.logger.log(`Resuming provisioning from checkpoint: ${progress.failedTask}`);
    }

    if (!selectedIndustry || !orgName) {
      throw new BadRequestException('Missing required fields: industry and org name');
    }

    const config = this.industryFactory.getProvisioningConfig(selectedIndustry as string);
    if (!config) throw new BadRequestException('Invalid industry selected');

    await this.prisma.onboardingSession.update({
      where: { id: sessionId },
      data: { provisionStatus: 'PROVISIONING' },
    });

    this.metricsService.recordSessionStart(sessionId);

    try {
      const dispatchResult = await this.dispatcher.dispatch(sessionId);
      if (!dispatchResult.success || !dispatchResult.result) {
        throw new Error(dispatchResult.error ?? 'Provisioning failed');
      }
      const result = dispatchResult.result;

      await this.progressService.markCompleted(sessionId, result.org.id, result.subscription?.id ?? null);

      await this.checklistService.initChecklist(sessionId);

      this.metricsService.recordSessionComplete(sessionId);

      await this.auditService.record({
        userId: (session.userId as string) ?? undefined,
        organizationId: result.org.id,
        action: 'ONBOARDING_PROVISIONED',
        status: 'SUCCESS',
        entity: 'OnboardingSession',
        entityId: sessionId,
        metadata: { email: session.email as string, industry: selectedIndustry as string },
      });

      this.compensationManager.clear();

      return this.mapSession(
        await this.prisma.onboardingSession.findUnique({ where: { id: sessionId } }),
      );
    } catch (error) {
      this.logger.error(`Provisioning failed for ${sessionId}: ${(error as Error).message}`);

      this.metricsService.recordSessionFailed(sessionId);

      await this.auditService.record({
        action: 'PROVISION_FAILED',
        status: 'FAILURE',
        entity: 'OnboardingSession',
        entityId: sessionId,
        metadata: { error: (error as Error).message, email: session.email },
      });

      await this.progressService.markFailed(sessionId, 'provisioning', (error as Error).message);
      await this.compensationManager.rollback(sessionId);
      throw error;
    }
  }

  private mapSession(session: Record<string, unknown> | null) {
    if (!session) return null;
    return {
      id: session.id, email: session.email, name: session.name,
      userId: session.userId as string ?? null,
      version: (session.version as number) ?? 1,
      currentStep: session.currentStep as number,
      completedSteps: (session.completedSteps as number[]) ?? [],
      selectedIndustry: selectedIndustry as string ?? null,
      selectedCategory: session.selectedCategory as string ?? null,
      selectedCategories: (session.selectedCategories as string[]) ?? [],
      orgName: orgName as string ?? null, orgEmail: session.orgEmail as string ?? null,
      orgPhone: session.orgPhone as string ?? null, orgWebsite: session.orgWebsite as string ?? null,
      orgCountry: session.orgCountry as string ?? null, orgState: session.orgState as string ?? null,
      orgCity: session.orgCity as string ?? null, orgAddress: session.orgAddress as string ?? null,
      orgTimezone: session.orgTimezone as string ?? null, orgCurrency: session.orgCurrency as string ?? null,
      orgLanguage: session.orgLanguage as string ?? null,
      businessProfile: session.businessProfile as Record<string, unknown> ?? null,
      selectedModules: (session.selectedModules as string[]) ?? [],
      aiEnabled: (session.aiEnabled as boolean) ?? false,
      aiLanguage: session.aiLanguage as string ?? null, aiPersonality: session.aiPersonality as string ?? null,
      selectedPlanId: session.selectedPlanId as string ?? null,
      provisionStatus: session.provisionStatus as string ?? 'PENDING',
      provisionData: session.provisionData as Record<string, unknown> ?? null,
      organizationId: session.organizationId as string ?? null,
      createdAt: (session.createdAt as Date).toISOString(),
      updatedAt: (session.updatedAt as Date).toISOString(),
    };
  }
}
