import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BillingInterval } from './dto/billing.dto';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getPublicPlans() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
    });
    return plans.map((plan) => this.serializePlan(plan));
  }

  async getSubscription(organizationId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });

    if (!subscription) {
      return null;
    }

    return this.serializeSubscription(subscription);
  }

  async startTrial(
    organizationId: string,
    planId: string,
    billingInterval: BillingInterval = BillingInterval.MONTHLY,
    userId?: string,
  ) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }
    if (!plan.isActive) {
      throw new BadRequestException('This plan is not available');
    }

    const trialDays = plan.freeTrialDays || 30;
    const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

    const existing = await this.prisma.subscription.findUnique({
      where: { organizationId },
    });

    let subscription;
    if (existing) {
      subscription = await this.prisma.subscription.update({
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
        include: { plan: true },
      });
    } else {
      subscription = await this.prisma.subscription.create({
        data: {
          organizationId,
          planId: plan.id,
          status: 'TRIALING',
          billingInterval,
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEndsAt,
          trialEndsAt,
        },
        include: { plan: true },
      });
    }

    await this.auditService.record({
      userId,
      organizationId,
      action: 'SUBSCRIPTION.TRIAL_STARTED',
      entity: 'Subscription',
      entityId: subscription.id,
      status: 'SUCCESS',
      metadata: { planId: plan.id, planSlug: plan.slug, trialDays },
    });

    return this.serializeSubscription(subscription);
  }

  async changePlan(
    organizationId: string,
    planId: string,
    billingInterval?: BillingInterval,
    userId?: string,
  ) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }
    if (!plan.isActive) {
      throw new BadRequestException('This plan is not available');
    }

    const existing = await this.prisma.subscription.findUnique({
      where: { organizationId },
    });

    if (!existing) {
      return this.startTrial(organizationId, planId, billingInterval ?? BillingInterval.MONTHLY, userId);
    }

    const interval = billingInterval ?? existing.billingInterval;
    const updated = await this.prisma.subscription.update({
      where: { id: existing.id },
      data: {
        planId: plan.id,
        billingInterval: interval,
        status: existing.status === 'CANCELLED' || existing.status === 'EXPIRED' ? 'TRIALING' : existing.status,
        currentPeriodEnd:
          existing.status === 'CANCELLED' || existing.status === 'EXPIRED'
            ? new Date(Date.now() + (plan.freeTrialDays || 30) * 24 * 60 * 60 * 1000)
            : existing.currentPeriodEnd,
        trialEndsAt:
          existing.status === 'CANCELLED' || existing.status === 'EXPIRED'
            ? new Date(Date.now() + (plan.freeTrialDays || 30) * 24 * 60 * 60 * 1000)
            : existing.trialEndsAt,
        canceledAt: null,
      },
      include: { plan: true },
    });

    await this.auditService.record({
      userId,
      organizationId,
      action: 'SUBSCRIPTION.PLAN_CHANGED',
      entity: 'Subscription',
      entityId: updated.id,
      status: 'SUCCESS',
      metadata: { previousPlanId: existing.planId, planId: plan.id, planSlug: plan.slug, billingInterval: interval },
    });

    return this.serializeSubscription(updated);
  }

  async getPaymentHistory(organizationId: string) {
    const payments = await this.prisma.subscriptionPayment.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });
    return payments.map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount),
      currency: payment.currency,
      billingInterval: payment.billingInterval,
      status: payment.status,
      gateway: payment.gateway,
      transactionRef: payment.transactionRef,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      plan: payment.plan ? { name: payment.plan.name, slug: payment.plan.slug } : null,
    }));
  }

  async getInvoices(organizationId: string) {
    const invoices = await this.prisma.subscriptionInvoice.findMany({
      where: { organizationId },
      orderBy: { issuedAt: 'desc' },
    });
    return invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: Number(invoice.amount),
      currency: invoice.currency,
      billingInterval: invoice.billingInterval,
      status: invoice.status,
      issuedAt: invoice.issuedAt,
      dueAt: invoice.dueAt,
      paidAt: invoice.paidAt,
      pdfUrl: invoice.pdfUrl,
    }));
  }

  async getGateways() {
    return this.prisma.paymentGateway.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  private serializePlan(plan: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    price: { toString(): string };
    yearlyPrice: { toString(): string } | null;
    currency: string;
    interval: string;
    freeTrialDays: number;
    aiCredits: number;
    reportsEnabled: boolean;
    apiAccess: boolean;
    integrations: unknown;
    prioritySupport: boolean;
    customBranding: boolean;
    securityFeatures: unknown;
    recommended: boolean;
    sortOrder: number;
    features: unknown;
    modules: unknown;
    maxUsers: number;
    maxStorage: number;
    maxCustomers: number;
    maxProducts: number;
    isActive: boolean;
  }) {
    return {
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      price: Number(plan.price),
      yearlyPrice: plan.yearlyPrice ? Number(plan.yearlyPrice) : null,
      currency: plan.currency,
      interval: plan.interval,
      freeTrialDays: plan.freeTrialDays,
      aiCredits: plan.aiCredits,
      reportsEnabled: plan.reportsEnabled,
      apiAccess: plan.apiAccess,
      integrations: plan.integrations,
      prioritySupport: plan.prioritySupport,
      customBranding: plan.customBranding,
      securityFeatures: plan.securityFeatures,
      recommended: plan.recommended,
      sortOrder: plan.sortOrder,
      features: plan.features,
      modules: plan.modules,
      maxUsers: plan.maxUsers,
      maxStorage: plan.maxStorage,
      maxCustomers: plan.maxCustomers,
      maxProducts: plan.maxProducts,
      isActive: plan.isActive,
    };
  }

  private serializeSubscription(subscription: {
    id: string;
    organizationId: string;
    planId: string;
    status: string;
    billingInterval: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    trialEndsAt: Date | null;
    canceledAt: Date | null;
    createdAt: Date;
    plan: {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      price: { toString(): string };
      yearlyPrice: { toString(): string } | null;
      currency: string;
      interval: string;
      freeTrialDays: number;
      maxUsers: number;
      maxStorage: number;
    };
  }) {
    const now = new Date();
    let trialDaysRemaining = 0;
    if (subscription.status === 'TRIALING' && subscription.trialEndsAt) {
      trialDaysRemaining = Math.max(0, Math.ceil((subscription.trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
    }

    return {
      id: subscription.id,
      organizationId: subscription.organizationId,
      planId: subscription.planId,
      status: subscription.status,
      billingInterval: subscription.billingInterval,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialEndsAt: subscription.trialEndsAt,
      trialDaysRemaining,
      canceledAt: subscription.canceledAt,
      plan: {
        id: subscription.plan.id,
        name: subscription.plan.name,
        slug: subscription.plan.slug,
        description: subscription.plan.description,
        price: Number(subscription.plan.price),
        yearlyPrice: subscription.plan.yearlyPrice ? Number(subscription.plan.yearlyPrice) : null,
        currency: subscription.plan.currency,
        interval: subscription.plan.interval,
        freeTrialDays: subscription.plan.freeTrialDays,
        maxUsers: subscription.plan.maxUsers,
        maxStorage: subscription.plan.maxStorage,
      },
    };
  }

  requireOrg(organizationId?: string): string {
    if (!organizationId) {
      throw new ForbiddenException('User does not belong to an organization');
    }
    return organizationId;
  }
}
