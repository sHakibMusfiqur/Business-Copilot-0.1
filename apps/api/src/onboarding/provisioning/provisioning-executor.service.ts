import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IndustryTemplateFactory } from '../industry-templates/industry-template.factory';
import type { ProvisioningConfig } from '../industry-templates/types';
import type { ProvisioningContext } from '../industry-templates/industry-template-provider.interface';

export interface ProvisionResult {
  org: { id: string };
  subscription: { id: string } | null;
}

export interface CheckpointResult {
  success: boolean;
  checkpoint: number;
  task: string;
  tasks: string[];
  result?: ProvisionResult;
}

@Injectable()
export class ProvisioningExecutorService {
  private readonly logger = new Logger(ProvisioningExecutorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly industryFactory: IndustryTemplateFactory,
  ) {}

  async executeCheckpoint(
    session: Record<string, unknown>,
    config: ProvisioningConfig,
    startCheckpoint: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
  ): Promise<CheckpointResult> {
    const tasks: string[] = [];
    let result: ProvisionResult | undefined;

    if (startCheckpoint <= 1) {
      await this.doCreateOrg(session, tasks, tx);
    }
    if (startCheckpoint <= 2) {
      await this.doAssignOwner(session, tasks, tx);
    }
    if (startCheckpoint <= 3) {
      await this.doCreateOwnerRole(session, tasks, tx);
    }
    if (startCheckpoint <= 4) {
      await this.doConfigureDepartments(session, config, tasks, tx);
    }
    if (startCheckpoint <= 5) {
      await this.doSetupSubscription(session, tasks, tx);
    }
    if (startCheckpoint <= 6) {
      await this.doApplySettings(session, config, tasks, tx);
    }
    if (startCheckpoint <= 7) {
      const lifecycleResult = await this.doIndustryLifecycle(session, config, tasks, tx);
      if (lifecycleResult) result = lifecycleResult;
    }

    if (!result) {
      const latestOrg = await tx.organization.findFirst({ orderBy: { createdAt: 'desc' } });
      if (latestOrg) {
        const sub = await tx.subscription.findUnique({ where: { organizationId: latestOrg.id } });
        result = { org: latestOrg, subscription: sub ?? null };
      }
    }

    return {
      success: true,
      checkpoint: 7,
      task: 'Complete',
      tasks,
      result,
    };
  }

  private async doCreateOrg(
    session: Record<string, unknown>,
    tasks: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
  ): Promise<{ org: { id: string } }> {
    const slug = await this.generateSlug(tx, session);
    const org = await tx.organization.create({
      data: {
        name: session.orgName as string,
        slug,
        email: (session.orgEmail as string) ?? null,
        phone: (session.orgPhone as string) ?? null,
        address: (session.orgAddress as string) ?? null,
        city: (session.orgCity as string) ?? null,
        state: (session.orgState as string) ?? null,
        country: (session.orgCountry as string) ?? null,
        timezone: (session.orgTimezone as string) ?? undefined,
      },
    });
    tasks.push('Organization created');
    return { org };
  }

  private async doAssignOwner(
    session: Record<string, unknown>,
    tasks: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
  ): Promise<void> {
    if (!session.userId) return;
    const org = await tx.organization.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!org) return;
    await tx.user.update({
      where: { id: session.userId as string },
      data: { organizationId: org.id },
    });
    const existing = await tx.organizationMember.findFirst({
      where: { organizationId: org.id, userId: session.userId as string },
    });
    if (!existing) {
      await tx.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: session.userId as string,
          role: 'OWNER',
        },
      });
    }
    tasks.push('Owner assigned');
  }

  private async doCreateOwnerRole(
    session: Record<string, unknown>,
    tasks: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
  ): Promise<void> {
    const org = await tx.organization.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!org) return;
    const allPerms: { id: string }[] = await tx.permission.findMany({ select: { id: true } });
    const ownerRole = await tx.role.create({
      data: {
        name: 'Owner',
        description: 'Full access to all organization features',
        isSystem: true,
        organizationId: org.id,
      },
    });
    if (allPerms.length > 0) {
      await tx.rolePermission.createMany({
        data: allPerms.map((p) => ({ roleId: ownerRole.id, permissionId: p.id })),
      });
    }
    if (session.userId) {
      await tx.userRoleAssignment.create({
        data: { userId: session.userId as string, roleId: ownerRole.id },
      });
    }
    tasks.push('Owner role created');
  }

  private async doConfigureDepartments(
    session: Record<string, unknown>,
    config: ProvisioningConfig,
    tasks: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
  ): Promise<void> {
    const org = await tx.organization.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!org) return;
    for (const dept of config.departments) {
      const code = dept.name
        .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 16)
        + `_${org.id.slice(0, 8)}`;
      await tx.department.create({ data: { name: dept.name, code, isActive: true } });
    }
    tasks.push('Departments configured');
  }

  private async doSetupSubscription(
    session: Record<string, unknown>,
    tasks: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
  ): Promise<void> {
    const selectedModules = (session.selectedModules as string[]) ?? [];
    if (session.selectedPlanId && (selectedModules.length === 0 || selectedModules.includes('subscription'))) {
      const org = await tx.organization.findFirst({ orderBy: { createdAt: 'desc' } });
      if (!org) return;
      const plan = await tx.subscriptionPlan.findUnique({
        where: { id: session.selectedPlanId as string },
      });
      if (plan) {
        await tx.subscription.create({
          data: {
            organizationId: org.id,
            planId: plan.id,
            status: 'TRIALING',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
        });
        tasks.push('Subscription active');
      }
    }
  }

  private async doApplySettings(
    session: Record<string, unknown>,
    config: ProvisioningConfig,
    tasks: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
  ): Promise<void> {
    const org = await tx.organization.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!org) return;
    await tx.organizationSettings.create({
      data: {
        organizationId: org.id,
        settings: {
          industry: session.selectedIndustry,
          industryCategory: session.selectedCategory ?? null,
          businessProfile: session.businessProfile ?? null,
          aiEnabled: session.aiEnabled ?? false,
          aiLanguage: session.aiLanguage ?? null,
          aiPersonality: session.aiPersonality ?? null,
          provisioningConfig: JSON.parse(JSON.stringify(config)),
          defaults: config.defaults ?? null,
        },
      },
    });
    tasks.push('Settings applied');
  }

  private async doIndustryLifecycle(
    session: Record<string, unknown>,
    config: ProvisioningConfig,
    tasks: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
  ): Promise<ProvisionResult | undefined> {
    const org = await tx.organization.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!org || !session.selectedIndustry) return;

    const provider = this.industryFactory.getProvider(session.selectedIndustry as string);
    if (!provider) return;

    const context: ProvisioningContext = {
      sessionId: session.id as string,
      userId: session.userId as string | undefined,
      orgName: session.orgName as string,
      orgEmail: session.orgEmail as string | undefined,
      selectedIndustry: session.selectedIndustry as string,
      selectedModules: (session.selectedModules as string[]) ?? [],
      businessProfile: session.businessProfile as Record<string, unknown> | undefined,
    };

    if (provider.prepare) await provider.prepare(tx, context);
    if (provider.provision) await provider.provision(tx, context, org.id);
    tasks.push('Industry lifecycle complete');

    const sub = await tx.subscription.findUnique({ where: { organizationId: org.id } });
    return { org, subscription: sub ?? null };
  }

  private async generateSlug(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    session: Record<string, unknown>,
  ): Promise<string> {
    const base = ((session.orgName as string) ?? '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      || `org-${(session.id as string).slice(0, 8)}`;
    let slug = base;
    let suffix = 2;
    while (await tx.organization.findUnique({ where: { slug } })) {
      slug = `${base}-${suffix}`;
      suffix++;
    }
    return slug;
  }
}
