import { ConflictException, Injectable } from '@nestjs/common';
import { IndustryTemplateFactory } from '../industry-templates/industry-template.factory';
import type { ProvisioningConfig } from '../industry-templates/types';
import type { ProvisioningContext } from '../industry-templates/industry-template-provider.interface';
import { CHECKPOINT_TASKS } from './provisioning-checkpoints';

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

export interface CheckpointObservation {
  task: string;
  progress: number;
  completedTasks: string[];
}

@Injectable()
export class ProvisioningExecutorService {
  constructor(
    private readonly industryFactory: IndustryTemplateFactory,
  ) {}

  async executeCheckpoint(
    session: Record<string, unknown>,
    config: ProvisioningConfig,
    startCheckpoint: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    onCheckpoint?: (observation: CheckpointObservation) => void | Promise<void>,
  ): Promise<CheckpointResult> {
    const tasks: string[] = [];
    let result: ProvisionResult | undefined;

    const observe = async (index: number): Promise<void> => {
      if (onCheckpoint) {
        await onCheckpoint({
          task: CHECKPOINT_TASKS[index].task,
          progress: CHECKPOINT_TASKS[index].progress,
          completedTasks: [...tasks],
        });
      }
    };

    if (startCheckpoint <= CHECKPOINT_TASKS[0].checkpoint) {
      await this.runCheckpoint(CHECKPOINT_TASKS[0].task, async () => {
        const created = await this.doCreateOrg(session, tasks, tx);
        // Bind this invocation (and any resume) to the organization we just
        // created. Resolving by "latest org" races with concurrent provisions
        // and can attach owner/roles/subscription/settings to the wrong tenant.
        session.organizationId = created.org.id;
      });
      await observe(0);
    }
    if (startCheckpoint <= CHECKPOINT_TASKS[1].checkpoint) {
      await this.runCheckpoint(CHECKPOINT_TASKS[1].task, () => this.doAssignOwner(session, tasks, tx));
      await observe(1);
    }
    if (startCheckpoint <= CHECKPOINT_TASKS[2].checkpoint) {
      await this.runCheckpoint(CHECKPOINT_TASKS[2].task, () => this.doCreateOwnerRole(session, tasks, tx));
      await observe(2);
    }
    if (startCheckpoint <= CHECKPOINT_TASKS[3].checkpoint) {
      await this.runCheckpoint(CHECKPOINT_TASKS[3].task, () => this.doConfigureDepartments(session, config, tasks, tx));
      await observe(3);
    }
    if (startCheckpoint <= CHECKPOINT_TASKS[4].checkpoint) {
      await this.runCheckpoint(CHECKPOINT_TASKS[4].task, () => this.doSetupSubscription(session, tasks, tx));
      await observe(4);
    }
    if (startCheckpoint <= CHECKPOINT_TASKS[5].checkpoint) {
      await this.runCheckpoint(CHECKPOINT_TASKS[5].task, () => this.doApplySettings(session, config, tasks, tx));
      await observe(5);
    }
    if (startCheckpoint <= CHECKPOINT_TASKS[6].checkpoint) {
      await this.runCheckpoint(CHECKPOINT_TASKS[6].task, async () => {
        const lifecycleResult = await this.doIndustryLifecycle(session, tasks, tx);
        if (lifecycleResult) result = lifecycleResult;
      });
      await observe(6);
    }

    if (!result) {
      const org = await this.resolveOrg(tx, session);
      if (org) {
        const sub = await tx.subscription.findUnique({ where: { organizationId: org.id } });
        result = { org, subscription: sub ?? null };
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

  /**
   * Runs a single checkpoint and, on failure, records the checkpoint id that
   * was in flight on the thrown error so the engine can persist the real
   * failing checkpoint into provisionData.failedTask (instead of the generic
   * "provisioning") and the next dispatch resumes at the correct place.
   */
  private async runCheckpoint(task: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (error) {
      (error as { failedTask?: string }).failedTask = task;
      throw error;
    }
  }

  private async doCreateOrg(
    session: Record<string, unknown>,
    tasks: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
  ): Promise<{ org: { id: string } }> {
    if (session.organizationId) {
      const existingBySession = await tx.organization.findUnique({
        where: { id: session.organizationId as string },
      });
      if (existingBySession) {
        tasks.push('Organization created');
        return { org: existingBySession };
      }
    }

    const slug = await this.generateSlug(tx, session);
    let org: { id: string };
    try {
      org = await tx.organization.create({
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
    } catch (error) {
      // A colliding name belongs to another tenant — never reuse it. Failing
      // provisioning is the only safe outcome.
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException(
          'An organization with this name already exists. Please choose a different name.',
        );
      }
      throw error;
    }
    if (session.id) {
      await tx.onboardingSession.update({
        where: { id: session.id as string },
        data: { organizationId: org.id },
      });
    }
    tasks.push('Organization created');
    return { org };
  }

  /**
   * Resolves the organization owned by this session. Only the session's own
   * organizationId may be used. A globally-scoped lookup (e.g. "latest org")
   * could attach owner/roles/subscription/settings to another tenant.
   */
  private async resolveOrg(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    session: Record<string, unknown>,
  ): Promise<{ id: string } | null> {
    if (!session.organizationId) return null;
    return tx.organization.findUnique({
      where: { id: session.organizationId as string },
    });
  }

  private async doAssignOwner(
    session: Record<string, unknown>,
    tasks: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
  ): Promise<void> {
    if (!session.userId) return;
    const org = await this.resolveOrg(tx, session);
    if (!org) return;

    // Atomically claim the user for this organization at the DB boundary.
    // `updateMany` only matches rows whose current organizationId is null or
    // already equals this org, so two concurrent onboarding sessions for the
    // same user cannot both pass: the loser updates 0 rows and aborts the
    // whole transaction (org creation included) instead of silently
    // re-pointing user.organizationId. Resuming this session's own org
    // (organizationId === org.id, e.g. a partial commit) still succeeds.
    const claimed = await tx.user.updateMany({
      where: {
        id: session.userId as string,
        OR: [{ organizationId: null }, { organizationId: org.id }],
      },
      data: { organizationId: org.id },
    });
    if (claimed.count === 0) {
      throw new ConflictException(
        'This account already belongs to an organization and cannot provision another one',
      );
    }

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
    const org = await this.resolveOrg(tx, session);
    if (!org) return;
    const allPerms: { id: string }[] = await tx.permission.findMany({ select: { id: true } });
    const ownerRole =
      (await tx.role.findFirst({
        where: { organizationId: org.id, name: 'Owner' },
      })) ??
      (await tx.role.create({
        data: {
          name: 'Owner',
          description: 'Full access to all organization features',
          isSystem: true,
          organizationId: org.id,
        },
      }));
    if (allPerms.length > 0) {
      await tx.rolePermission.createMany({
        data: allPerms.map((p) => ({ roleId: ownerRole.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }
    if (session.userId) {
      const existingAssignment = await tx.userRoleAssignment.findFirst({
        where: { userId: session.userId as string, roleId: ownerRole.id },
      });
      if (!existingAssignment) {
        await tx.userRoleAssignment.create({
          data: { userId: session.userId as string, roleId: ownerRole.id },
        });
      }
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
    const org = await this.resolveOrg(tx, session);
    if (!org) return;
    const departments = config.departments.map((dept) => {
      const code = dept.name
        .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 16)
        + `_${org.id.slice(0, 8)}`;
      return { name: dept.name, code, isActive: true };
    });
    if (departments.length > 0) {
      await tx.department.createMany({ data: departments, skipDuplicates: true });
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
      const org = await this.resolveOrg(tx, session);
      if (!org) return;
      const plan = await tx.subscriptionPlan.findUnique({
        where: { id: session.selectedPlanId as string },
      });
      if (plan) {
        const trialDays = plan.freeTrialDays || 30;
        const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
        const billingInterval = session.planInterval === 'YEARLY' ? 'YEARLY' : 'MONTHLY';
        const existing = await tx.subscription.findUnique({ where: { organizationId: org.id } });
        if (existing) {
          await tx.subscription.update({
            where: { id: existing.id },
            data: {
              planId: plan.id,
              status: 'TRIALING',
              billingInterval,
              currentPeriodStart: new Date(),
              currentPeriodEnd: trialEndsAt,
              trialEndsAt,
              canceledAt: null,
            },
          });
        } else {
          await tx.subscription.create({
            data: {
              organizationId: org.id,
              planId: plan.id,
              status: 'TRIALING',
              billingInterval,
              currentPeriodStart: new Date(),
              currentPeriodEnd: trialEndsAt,
              trialEndsAt,
            },
          });
        }
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
    const org = await this.resolveOrg(tx, session);
    if (!org) return;
    const settings = {
      industry: session.selectedIndustry,
      industryCategory: session.selectedCategory ?? null,
      businessProfile: session.businessProfile ?? null,
      aiEnabled: session.aiEnabled ?? false,
      aiLanguage: session.aiLanguage ?? null,
      aiPersonality: session.aiPersonality ?? null,
      provisioningConfig: JSON.parse(JSON.stringify(config)),
      defaults: config.defaults ?? null,
    };
    await tx.organizationSettings.upsert({
      where: { organizationId: org.id },
      create: { organizationId: org.id, settings },
      update: { settings },
    });
    tasks.push('Settings applied');
  }

  private async doIndustryLifecycle(
    session: Record<string, unknown>,
    tasks: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
  ): Promise<ProvisionResult | undefined> {
    const org = await this.resolveOrg(tx, session);
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
