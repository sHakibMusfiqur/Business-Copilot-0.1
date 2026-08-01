import {
  Injectable, Logger, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { IndustryTemplateFactory } from './industry-templates/industry-template.factory';
import { SessionConflictError } from './errors/session-conflict.error';
import type { CreateSessionDto } from './dto/create-session.dto';
import type { UpdateSessionDto } from './dto/update-session.dto';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly industryFactory: IndustryTemplateFactory,
  ) {}

  async getIndustries() {
    return this.industryFactory.getAllTemplates().map(({ id, name, description, icon, color, categories, defaultModules, estimatedUsers, estimatedMonthlyPrice }) => ({
      id, name, description, icon, color, categories, defaultModules, estimatedUsers, estimatedMonthlyPrice,
    }));
  }

  async createSession(dto: CreateSessionDto) {
    const existing = await this.prisma.onboardingSession.findFirst({
      where: { email: dto.email, provisionStatus: 'PENDING' },
      orderBy: { updatedAt: 'desc' },
    });

    if (existing) {
      const age = Date.now() - existing.updatedAt.getTime();
      if (age < SESSION_TTL_MS) {
        return this.mapSession(existing);
      }
      await this.prisma.onboardingSession.update({
        where: { id: existing.id },
        data: { provisionStatus: 'EXPIRED' },
      });
    }

    const session = await this.prisma.onboardingSession.create({
      data: {
        email: dto.email,
        name: dto.name,
        currentStep: 0,
        completedSteps: [],
        version: 1,
      },
    });

    await this.auditService.record({
      action: 'ONBOARDING_SESSION_CREATED',
      status: 'SUCCESS',
      entity: 'OnboardingSession',
      entityId: session.id,
      metadata: { email: dto.email, name: dto.name },
    });

    return this.mapSession(session);
  }

  async getSession(sessionId: string) {
    const session = await this.prisma.onboardingSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Onboarding session not found');

    if (session.provisionStatus === 'EXPIRED') {
      throw new ConflictException('Session expired. Please start a new onboarding.');
    }

    const age = Date.now() - session.updatedAt.getTime();
    if (age > SESSION_TTL_MS && session.provisionStatus === 'PENDING') {
      await this.prisma.onboardingSession.update({
        where: { id: sessionId },
        data: { provisionStatus: 'EXPIRED' },
      });
      throw new ConflictException('Session expired');
    }

    return this.mapSession(session);
  }

  async getSessionByEmail(email: string) {
    const session = await this.prisma.onboardingSession.findFirst({
      where: { email, provisionStatus: 'PENDING' },
      orderBy: { updatedAt: 'desc' },
    });
    if (!session) throw new NotFoundException('No active onboarding session found');

    const age = Date.now() - session.updatedAt.getTime();
    if (age > SESSION_TTL_MS) {
      await this.prisma.onboardingSession.update({
        where: { id: session.id },
        data: { provisionStatus: 'EXPIRED' },
      });
      throw new ConflictException('Session expired');
    }

    return this.mapSession(session);
  }

  async updateSession(sessionId: string, dto: UpdateSessionDto) {
    const session = await this.prisma.onboardingSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Onboarding session not found');
    if (session.provisionStatus === 'EXPIRED') throw new ConflictException('Session expired');

    const data: Record<string, unknown> = {};
    const fields: (keyof UpdateSessionDto)[] = [
      'currentStep', 'selectedIndustry', 'selectedCategory', 'selectedCategories', 'orgName', 'orgEmail',
      'orgPhone', 'orgWebsite', 'orgCountry', 'orgState', 'orgCity', 'orgAddress',
      'orgTimezone', 'orgCurrency', 'orgLanguage', 'businessProfile', 'selectedModules',
      'aiEnabled', 'aiLanguage', 'aiPersonality', 'selectedPlanId', 'planInterval', 'userId',
    ];
    if (dto.selectedCategories && dto.selectedCategories.length > 0) {
      data.selectedCategory = dto.selectedCategories[0];
    } else if (dto.selectedCategories && dto.selectedCategories.length === 0) {
      data.selectedCategory = null;
    }
    const changedFields: string[] = [];
    for (const field of fields) {
      if (dto[field] !== undefined) {
        data[field] = dto[field];
        changedFields.push(field);
      }
    }

    if (session.userId && dto.userId === undefined) {
      data.userId = session.userId;
    }

    if (dto.version !== undefined) {
      data.version = { increment: 1 };
    } else {
      data.version = session.version + 1;
    }

    const versionCondition = dto.version ?? session.version;

    const updated = await this.prisma.onboardingSession.updateMany({
      where: { id: sessionId, version: versionCondition },
      data: data as never,
    });

    if (updated.count === 0) {
      const current = await this.prisma.onboardingSession.findUnique({ where: { id: sessionId } });
      throw new SessionConflictError({
        sessionId,
        currentVersion: current?.version as number ?? session.version,
        incomingVersion: versionCondition,
        requestedFields: changedFields,
      });
    }

    const refreshed = await this.prisma.onboardingSession.findUnique({ where: { id: sessionId } });

    await this.auditService.record({
      action: 'ONBOARDING_SESSION_UPDATED',
      status: 'SUCCESS',
      entity: 'OnboardingSession',
      entityId: sessionId,
      metadata: { email: session.email, step: dto.currentStep ?? session.currentStep, version: refreshed?.version },
    });

    return this.mapSession(refreshed);
  }

  async completeStep(sessionId: string, step: number) {
    const session = await this.prisma.onboardingSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Onboarding session not found');
    if (session.provisionStatus === 'EXPIRED') throw new ConflictException('Session expired');

    const completed = (session.completedSteps as number[] ?? []);
    if (!completed.includes(step)) {
      completed.push(step);
    }

    if (session.userId && !(session.completedSteps as number[]).includes(1)) {
      completed.push(1);
    }

    const updated = await this.prisma.onboardingSession.update({
      where: { id: sessionId },
      data: { currentStep: step + 1, completedSteps: completed, version: { increment: 1 } },
    });

    return this.mapSession(updated);
  }

  async getProvisioningPreview(sessionId: string) {
    const session = await this.prisma.onboardingSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Onboarding session not found');
    if (!session.selectedIndustry) throw new BadRequestException('No industry selected');

    const config = this.industryFactory.getProvisioningConfig(session.selectedIndustry);
    if (!config) throw new NotFoundException('Provisioning config not found for industry');

    return {
      industry: session.selectedIndustry,
      organization: { name: session.orgName, email: session.orgEmail },
      modules: (session.selectedModules as string[] ?? []),
      departments: config.departments.map((d) => ({ name: d.name, description: d.description })),
      roles: config.roles.map((r) => ({ name: r.name, description: r.description })),
      chartOfAccounts: config.chartOfAccounts,
      widgets: config.dashboardWidgets,
      defaults: config.defaults ?? null,
    };
  }

  private mapSession(session: Record<string, unknown> | null) {
    if (!session) return null;
    return {
      id: session.id,
      email: session.email,
      name: session.name,
      userId: session.userId as string ?? null,
      version: (session.version as number) ?? 1,
      currentStep: session.currentStep as number,
      completedSteps: (session.completedSteps as number[]) ?? [],
      selectedIndustry: session.selectedIndustry as string ?? null,
      selectedCategory: session.selectedCategory as string ?? null,
      selectedCategories: (session.selectedCategories as string[]) ?? [],
      orgName: session.orgName as string ?? null,
      orgEmail: session.orgEmail as string ?? null,
      orgPhone: session.orgPhone as string ?? null,
      orgWebsite: session.orgWebsite as string ?? null,
      orgCountry: session.orgCountry as string ?? null,
      orgState: session.orgState as string ?? null,
      orgCity: session.orgCity as string ?? null,
      orgAddress: session.orgAddress as string ?? null,
      orgTimezone: session.orgTimezone as string ?? null,
      orgCurrency: session.orgCurrency as string ?? null,
      orgLanguage: session.orgLanguage as string ?? null,
      businessProfile: session.businessProfile as Record<string, unknown> ?? null,
      selectedModules: (session.selectedModules as string[]) ?? [],
      aiEnabled: (session.aiEnabled as boolean) ?? false,
      aiLanguage: session.aiLanguage as string ?? null,
      aiPersonality: session.aiPersonality as string ?? null,
      selectedPlanId: session.selectedPlanId as string ?? null,
      planInterval: (session.planInterval as string) ?? 'MONTHLY',
      provisionStatus: session.provisionStatus as string ?? 'PENDING',
      provisionData: session.provisionData as Record<string, unknown> ?? null,
      organizationId: session.organizationId as string ?? null,
      createdAt: (session.createdAt as Date).toISOString(),
      updatedAt: (session.updatedAt as Date).toISOString(),
    };
  }
}
