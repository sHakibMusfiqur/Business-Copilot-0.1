import { Injectable } from '@nestjs/common';

import type { EntitlementInput, UsageLimits } from '@bc/core';

import { PrismaService } from '../prisma/prisma.service';



const ACTIVE_SUBSCRIPTION_STATUSES: ReadonlySet<string> = new Set([
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
]);


function normalizePlanModules(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(value.filter((entry): entry is string => typeof entry === 'string')),
    ).sort();
  }

  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .filter((key) => record[key] === true)
      .sort();
  }

  return [];
}


/** Normalizes the `SubscriptionPlan.features` JSON into a Record<string, boolean>. */
function normalizePlanFeatures(value: unknown): Record<string, boolean> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const record: Record<string, boolean> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      record[key] = entry === true;
    }
    return record;
  }
  return {};
}


/** Keeps only finite numeric limit values, mapped onto the UsageLimits keys. */
function normalizePlanLimits(limits: Partial<UsageLimits>): Partial<UsageLimits> {
  const normalized: Partial<UsageLimits> = {};
  for (const [key, value] of Object.entries(limits)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      (normalized as Record<string, number | undefined>)[key] = value;
    }
  }
  return normalized;
}



@Injectable()
export class WorkspacePlanEntitlements {
  constructor(private readonly prisma: PrismaService) {}


  async resolveForOrganization(organizationId: string): Promise<EntitlementInput | undefined> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { organizationId },
      select: {
        status: true,
        plan: {
          select: {
            slug: true,
            modules: true,
            features: true,
            maxUsers: true,
            maxStorage: true,
            maxCustomers: true,
            maxProducts: true,
            aiCredits: true,
          },
        },
      },
    });

    if (!subscription || !subscription.plan) {
      return undefined;
    }
    if (!ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
      return undefined;
    }

    const plan = subscription.plan;
    return {
      plan: plan.slug,
      modules: normalizePlanModules(plan.modules),
      features: normalizePlanFeatures(plan.features),
      limits: normalizePlanLimits({
        users: plan.maxUsers,
        customers: plan.maxCustomers,
        products: plan.maxProducts,
        storageGb: plan.maxStorage,
        aiCredits: plan.aiCredits,
      }),
    };
  }
}