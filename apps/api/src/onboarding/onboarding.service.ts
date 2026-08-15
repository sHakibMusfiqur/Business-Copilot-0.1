import {
  Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '../config/config.service';
import { IndustryTemplateFactory } from './industry-templates/industry-template.factory';
import { SessionConflictError } from './errors/session-conflict.error';
import type { CreateSessionDto } from './dto/create-session.dto';
import type { UpdateSessionDto } from './dto/update-session.dto';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000;
const SSE_TOKEN_TTL_SECONDS = 120;

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly industryFactory: IndustryTemplateFactory,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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
        return this.mapSessionWithToken(existing);
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

    return this.mapSessionWithToken(session);
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

    return this.mapSessionWithToken(session);
  }

  async updateSession(sessionId: string, dto: UpdateSessionDto, authenticatedUserId: string | null = null) {
    const session = await this.prisma.onboardingSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Onboarding session not found');
    if (session.provisionStatus === 'EXPIRED') throw new ConflictException('Session expired');

    
    if (dto.userId !== undefined) {
      if (!authenticatedUserId || authenticatedUserId !== dto.userId) {
        throw new ForbiddenException('You can only bind this onboarding session to your own account');
      }
     
      if (session.userId && session.userId !== dto.userId) {
        throw new ForbiddenException(
          'This onboarding session is already linked to another account',
        );
      }
    }

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

  /**
   * Issues a short-lived, single-purpose SSE credential bound to this session
   * AND to the current user identity.
   *
   * EventSource cannot attach headers, so the owner fetches this token (via a
   * route protected by OnboardingSessionGuard, i.e. only with the bound user's
   * JWT once a user is bound) and passes it as the `sseToken` query param.
   *
   * The `uid` claim is `null` for an anonymous session and the bound owner's
   * userId for a bound session. The guard rejects a token whose `uid` does not
   * match the session's current owner, so a credential issued before binding
   * stops working once the session is bound, and one user's credential never
   * works for another.
   *
   * `callerUserId` is the authenticated caller resolved from the guard's
   * request (undefined/anonymous when only the onboarding token was used). It
   * must match the session's bound owner when the session is bound.
   */
  async issueSseToken(sessionId: string, callerUserId: string | null) {
    const session = await this.prisma.onboardingSession.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true },
    });
    if (!session) {
      throw new NotFoundException('Onboarding session not found');
    }
    const boundUserId = (session.userId as string | null) ?? null;
    const caller = callerUserId ?? null;
    if (boundUserId !== caller) {
      throw new ForbiddenException('You do not have access to this onboarding session');
    }
    const token = this.jwtService.sign(
      { sub: session.id, purpose: 'sse', uid: boundUserId },
      {
        secret: this.configService.jwtSecret,
        expiresIn: SSE_TOKEN_TTL_SECONDS as JwtSignOptions['expiresIn'],
        issuer: 'bc-onboarding-sse',
        audience: 'bc-onboarding-sse-stream',
      },
    );
    return { token, expiresInSeconds: SSE_TOKEN_TTL_SECONDS };
  }

  /**
   * Issues a signed, single-purpose onboarding token bound to this session.
   * The raw token is only ever returned at session creation or to the
   * authenticated owner (via getSessionByEmail) and must be presented to
   * access session endpoints.
   */
  private mapSessionWithToken(session: Record<string, unknown> | null) {
    const mapped = this.mapSession(session);
    if (!mapped) return null;
    return {
      ...mapped,
      onboardingToken: this.jwtService.sign(
        { sub: mapped.id, purpose: 'onboarding' },
        {
          secret: this.configService.jwtSecret,
          expiresIn: SESSION_TTL_SECONDS as JwtSignOptions['expiresIn'],
          issuer: 'bc-onboarding',
          audience: 'bc-onboarding-session',
        },
      ),
    };
  }
}
