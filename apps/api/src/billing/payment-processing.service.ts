import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, SubscriptionPayment } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { GatewayRegistry } from './gateways/gateway-registry';
import type { PaymentVerificationResult, WebhookHandlingResult } from './gateways/payment-gateway.interface';
import { BillingInterval } from './dto/billing.dto';

export interface CheckoutResult {
  paymentId: string;
  checkoutUrl: string;
  gateway: string;
  sessionRef: string;
}

export interface VerifyResult {
  payment: Record<string, unknown>;
  subscription: Record<string, unknown> | null;
  invoice: Record<string, unknown> | null;
}

/**
 * Orchestrates the payment lifecycle: checkout session creation, verification,
 * webhook handling, and refunds. All state mutations that activate a
 * subscription and generate an invoice are performed inside a single database
 * transaction, and duplicate success/refund events are safely ignored.
 */
@Injectable()
export class PaymentProcessingService {
  private readonly logger = new Logger(PaymentProcessingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly gatewayRegistry: GatewayRegistry,
  ) {}

  async createCheckout(
    organizationId: string,
    userId: string,
    planId: string,
    billingInterval: BillingInterval = BillingInterval.MONTHLY,
  ): Promise<CheckoutResult> {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Subscription plan not found');
    if (!plan.isActive) throw new BadRequestException('This plan is not available');

    const provider = await this.gatewayRegistry.getActiveProvider();
    const amount = billingInterval === 'YEARLY' ? Number(plan.yearlyPrice ?? plan.price) : Number(plan.price);
    const currency = plan.currency || 'USD';

    // Prevent duplicate checkouts: reuse an in-flight PENDING payment for the
    // same org + plan + interval instead of stacking new sessions.
    const existingPending = await this.prisma.subscriptionPayment.findFirst({
      where: {
        organizationId,
        planId: plan.id,
        billingInterval,
        status: 'PENDING',
        gateway: provider.code,
      },
      orderBy: { createdAt: 'desc' },
    });

    let payment: SubscriptionPayment;
    if (existingPending) {
      payment = existingPending;
    } else {
      payment = await this.prisma.subscriptionPayment.create({
        data: {
          organizationId,
          planId: plan.id,
          amount,
          currency,
          billingInterval,
          status: 'PENDING',
          gateway: provider.code,
        },
      });
    }

    const webUrl = this.gatewayRegistry.getWebUrl();
    const successUrl = `${webUrl}/onboarding/payment?session_status=success&payment_id=${payment.id}`;
    const cancelUrl = `${webUrl}/onboarding/payment?session_status=cancelled&payment_id=${payment.id}`;

    const session = await provider.createCheckoutSession({
      paymentId: payment.id,
      organizationId,
      userId,
      planId: plan.id,
      planName: plan.name,
      amount,
      currency,
      billingInterval,
      successUrl,
      cancelUrl,
      metadata: { paymentId: payment.id },
    });

    await this.prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        transactionRef: session.sessionRef,
        gatewayData: {
          sessionId: session.sessionRef,
          checkoutUrl: session.checkoutUrl,
          ...(session.raw ?? {}),
        },
      },
    });

    await this.auditService.record({
      userId,
      organizationId,
      action: 'PAYMENT.CHECKOUT_CREATED',
      entity: 'SubscriptionPayment',
      entityId: payment.id,
      status: 'SUCCESS',
      metadata: {
        planId: plan.id,
        planSlug: plan.slug,
        billingInterval,
        amount,
        currency,
        gateway: provider.code,
        sessionRef: session.sessionRef,
      },
    });

    return {
      paymentId: payment.id,
      checkoutUrl: session.checkoutUrl,
      gateway: provider.code,
      sessionRef: session.sessionRef,
    };
  }

  async verifyPayment(
    organizationId: string,
    userId: string,
    paymentId: string,
  ): Promise<VerifyResult> {
    const payment = await this.prisma.subscriptionPayment.findFirst({
      where: { id: paymentId, organizationId },
      include: { plan: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    if (payment.status === 'SUCCEEDED') {
      return this.buildVerifyResult(payment, organizationId);
    }

    const gateway = payment.gateway;
    if (!gateway) {
      throw new BadRequestException('Payment has no gateway assigned');
    }
    const sessionRef = payment.transactionRef;
    if (!sessionRef) {
      throw new BadRequestException('Payment has no gateway session reference');
    }

    const provider = await this.gatewayRegistry.getProviderByCode(gateway);
    const verification = await provider.verifyPayment({
      sessionRef,
      paymentId: payment.id,
      organizationId,
      amount: Number(payment.amount),
      currency: payment.currency,
    });

    switch (verification.status) {
      case 'SUCCEEDED':
        return this.finalizeSuccessfulPayment(payment, userId, verification);
      case 'CANCELLED':
      case 'FAILED': {
        const updated = await this.markPaymentFailed(payment, userId, verification);
        return this.buildVerifyResult(updated, organizationId);
      }
      case 'PENDING':
      default:
        // Leave the payment PENDING; a webhook will confirm the final state.
        this.logger.log(`Payment ${payment.id} still pending at verification`);
        return this.buildVerifyResult(payment, organizationId);
    }
  }

  async handleWebhook(gatewayCode: string, rawBody: string, headers: Record<string, string>) {
    const provider = await this.gatewayRegistry.getProviderByCode(gatewayCode);
    const result = await provider.handleWebhook({ gatewayCode, rawBody, headers });

    if (!result.handled) {
      this.logger.log(`Ignoring unhandled ${gatewayCode} webhook event ${result.eventType}`);
      return { received: true, handled: false, eventType: result.eventType };
    }

    // Find the payment this event refers to (session id or transaction ref).
    const payment = await this.findPaymentByWebhook(result);
    if (!payment) {
      this.logger.warn(
        `Webhook ${result.eventType} referenced unknown payment (sessionRef=${result.sessionRef ?? 'none'}, txn=${result.transactionRef ?? 'none'})`,
      );
      return { received: true, handled: false, eventType: result.eventType, reason: 'unknown-payment' };
    }

    // Idempotency guard: never re-process the same gateway event id.
    const eventId = (result.metadata?.eventId as string | undefined) ?? null;
    if (eventId && this.hasSeenEvent(payment, eventId)) {
      this.logger.log(`Webhook event ${eventId} already processed for payment ${payment.id}`);
      return { received: true, handled: true, eventType: result.eventType, duplicate: true };
    }

    switch (result.status) {
      case 'SUCCEEDED':
        await this.finalizeSuccessfulPayment(payment, undefined, result);
        break;
      case 'REFUNDED':
        await this.markPaymentRefunded(payment, result);
        break;
      case 'CANCELLED':
      case 'FAILED':
        await this.markPaymentFailed(payment, undefined, result);
        break;
      default:
        return { received: true, handled: false, eventType: result.eventType, reason: 'unhandled-status' };
    }

    await this.recordWebhookAudit(payment, result);
    return { received: true, handled: true, eventType: result.eventType };
  }

  async refundPayment(
    organizationId: string,
    _userId: string,
    paymentId: string,
    amount?: number,
  ) {
    const payment = await this.prisma.subscriptionPayment.findFirst({
      where: { id: paymentId, organizationId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'SUCCEEDED') {
      throw new BadRequestException('Only succeeded payments can be refunded');
    }

    const gateway = payment.gateway;
    if (!gateway) throw new BadRequestException('Payment has no gateway assigned');

    // Only full refunds are producible today. The schema has no PARTIALLY_REFUNDED
    // state nor a refundedAmount column, so a partial amount is explicitly rejected
    // rather than being silently mis-recorded as a full refund. The refunded amount
    // can never exceed the original amount actually paid.
    const paidAmount = Number(payment.amount);
    const refundAmount = paidAmount;
    if (amount !== undefined) {
      const requested = Number(amount);
      if (!Number.isFinite(requested) || requested <= 0) {
        throw new BadRequestException('Refund amount must be a positive number');
      }
      if (requested > paidAmount) {
        throw new BadRequestException('Refund amount cannot exceed the original payment amount');
      }
      if (requested !== paidAmount) {
        throw new BadRequestException('Partial refunds are not supported; the refund amount must equal the full payment amount');
      }
    }

    const provider = await this.gatewayRegistry.getProviderByCode(gateway);
    const result = await provider.refundPayment({
      payment: {
        id: payment.id,
        amount: paidAmount,
        currency: payment.currency,
        transactionRef: payment.transactionRef,
        gatewayData: (payment.gatewayData ?? {}) as Record<string, unknown>,
      },
      amount: refundAmount,
      // Ties every refund attempt for this payment to a single gateway refund, so
      // concurrent or retried requests cannot double-refund at the gateway.
      idempotencyKey: `refund:${payment.id}`,
    });

    if (!result.refunded) {
      throw new BadRequestException('The gateway did not confirm the refund');
    }

    return this.markPaymentRefunded(payment, {
      eventType: 'refund.created',
      handled: true,
      status: 'REFUNDED',
      transactionRef: payment.transactionRef,
      metadata: { refundId: result.refundRef ?? undefined, refundedAmount: refundAmount },
      raw: result.raw,
    });
  }

  /**
   * Marks a payment SUCCEEDED, activates the subscription and issues the
   * invoice inside one transaction. Safe to call concurrently: a second
   * invocation observes the already-succeeded payment and returns early.
   */
  private async finalizeSuccessfulPayment(
    payment: SubscriptionPayment,
    userId: string | undefined,
    verification: PaymentVerificationResult | WebhookHandlingResult,
  ): Promise<VerifyResult> {
    const transactionRef = verification.transactionRef ?? payment.transactionRef;
    const eventId = (verification.metadata?.eventId as string | undefined) ?? null;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Serialize concurrent webhook deliveries for the same payment with a
        // row lock, so only one finalizer can observe the PENDING state.
        await tx.$queryRaw`SELECT id FROM "SubscriptionPayment" WHERE id = ${payment.id} FOR UPDATE`;

        const fresh = await tx.subscriptionPayment.findUnique({ where: { id: payment.id } });
        if (!fresh) throw new NotFoundException('Payment not found');

        if (fresh.status === 'SUCCEEDED') {
          const subscription = await tx.subscription.findUnique({
            where: { organizationId: fresh.organizationId },
          });
          const invoice = await tx.subscriptionInvoice.findFirst({
            where: { paymentId: fresh.id },
          });
          return { payment: fresh, subscription, invoice };
        }

        if (fresh.status === 'REFUNDED') {
          throw new BadRequestException('Cannot activate a refunded payment');
        }

        const plan = fresh.planId
          ? await tx.subscriptionPlan.findUnique({ where: { id: fresh.planId } })
          : null;
        if (!plan) throw new BadRequestException('Payment plan no longer exists');

        const billingInterval = fresh.billingInterval as 'MONTHLY' | 'YEARLY';
        const now = new Date();
        const periodEnd = new Date(
          now.getFullYear(),
          now.getMonth() + (billingInterval === 'YEARLY' ? 12 : 1),
          now.getDate(),
        );

        const subscription = await tx.subscription.upsert({
          where: { organizationId: fresh.organizationId },
          create: {
            organizationId: fresh.organizationId,
            planId: plan.id,
            status: 'ACTIVE',
            billingInterval,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
          update: {
            planId: plan.id,
            status: 'ACTIVE',
            billingInterval,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            trialEndsAt: null,
            canceledAt: null,
          },
        });

        const invoice = await this.createInvoice(tx, fresh, subscription.id, now);

        const updated = await tx.subscriptionPayment.update({
          where: { id: fresh.id },
          data: {
            status: 'SUCCEEDED',
            subscriptionId: subscription.id,
            transactionRef: transactionRef ?? fresh.transactionRef,
            paidAt: now,
            gatewayData: this.mergeGatewayData(fresh.gatewayData, {
              status: 'SUCCEEDED',
              paymentIntentId: transactionRef,
              eventId,
              finalizedAt: now.toISOString(),
              raw: verification.raw,
            }),
          },
        });

        return { payment: updated, subscription, invoice };
      });

      await this.auditService.record({
        userId,
        organizationId: payment.organizationId,
        action: 'PAYMENT.SUCCEEDED',
        entity: 'SubscriptionPayment',
        entityId: payment.id,
        status: 'SUCCESS',
        metadata: {
          amount: Number(payment.amount),
          currency: payment.currency,
          gateway: payment.gateway,
          transactionRef,
          subscriptionId: result.subscription?.id ?? null,
          invoiceId: result.invoice?.id ?? null,
        },
      });

      return this.buildVerifyResult(result.payment, payment.organizationId, result.subscription, result.invoice);
    } catch (error) {
      this.logger.error(
        `Failed to finalize payment ${payment.id}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  private async createInvoice(
    tx: Prisma.TransactionClient,
    payment: SubscriptionPayment,
    subscriptionId: string,
    issuedAt: Date,
  ) {
    const invoiceNumber = await this.nextInvoiceNumber(tx, payment.organizationId);
    return tx.subscriptionInvoice.create({
      data: {
        organizationId: payment.organizationId,
        subscriptionId,
        paymentId: payment.id,
        invoiceNumber,
        amount: payment.amount,
        currency: payment.currency,
        billingInterval: payment.billingInterval,
        status: 'PAID',
        issuedAt,
        dueAt: issuedAt,
        paidAt: issuedAt,
        metadata: { generatedBy: 'billing' },
      },
    });
  }

  private async nextInvoiceNumber(
    tx: Prisma.TransactionClient,
    organizationId: string,
  ): Promise<string> {
    const year = new Date().getFullYear();
    let sequence = 1;

    // Keep a per-org running sequence derived from existing invoices.
    const existing = await tx.subscriptionInvoice.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
      select: { invoiceNumber: true },
    });
    const prefix = `INV-${year}-`;
    const used = new Set(
      existing
        .map((i) => i.invoiceNumber)
        .filter((n) => n.startsWith(prefix))
        .map((n) => Number(n.slice(prefix.length)) || 0),
    );
    while (used.has(sequence)) sequence += 1;

    return `${prefix}${String(sequence).padStart(4, '0')}`;
  }

  private async markPaymentFailed(
    payment: SubscriptionPayment,
    userId: string | undefined,
    verification: PaymentVerificationResult | WebhookHandlingResult,
  ): Promise<SubscriptionPayment> {
    const status = verification.status === 'CANCELLED' ? 'CANCELLED' : 'FAILED';
    const eventId = (verification.metadata?.eventId as string | undefined) ?? null;

    // Atomic transition guard: only a PENDING payment may be failed/cancelled.
    // This protects against out-of-order delivery (e.g. an `expired` event
    // arriving after the session was actually paid and marked SUCCEEDED).
    const result = await this.prisma.subscriptionPayment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: {
        status,
        gatewayData: this.mergeGatewayData(payment.gatewayData, {
          status,
          eventId,
          reason: 'gateway-reported-failure',
        }),
      },
    });

    if (result.count === 0) {
      this.logger.warn(
        `Ignoring ${status} event for payment ${payment.id}: not in PENDING state (already ${payment.status})`,
      );
      return payment;
    }

    await this.auditService.record({
      userId,
      organizationId: payment.organizationId,
      action: `PAYMENT.${status}`,
      entity: 'SubscriptionPayment',
      entityId: payment.id,
      status: 'FAILURE',
      metadata: { gateway: payment.gateway, eventType: verification.eventType },
    });

    // Re-read the persisted row so callers see the failed/cancelled state instead
    // of the stale PENDING snapshot passed into this method.
    return (await this.prisma.subscriptionPayment.findUnique({ where: { id: payment.id } })) ?? payment;
  }

  private async markPaymentRefunded(
    payment: SubscriptionPayment,
    result: WebhookHandlingResult,
  ): Promise<VerifyResult> {
    const refundId = (result.metadata?.refundId as string | undefined) ?? null;
    const refundedAmount = Number(result.metadata?.refundedAmount ?? payment.amount);

    const updated = await this.prisma.$transaction(async (tx) => {
      // F-2: Serialize concurrent refund requests for the same payment with a row
      // lock, mirroring finalizeSuccessfulPayment. Only transactions able to lock
      // the row proceed; the guarded updateMany below then selects the single winner.
      //
      // IMPORTANT: this lock does NOT span the external Stripe call (the gateway is
      // invoked before markPaymentRefunded), so it cannot serialize the gateway
      // request itself. Holding a DB transaction open across an HTTP call would be
      // unsafe and is deliberately avoided. Duplicate/retried gateway attempts are
      // instead made safe by the deterministic idempotency key (`refund:<paymentId>`),
      // which the gateway deduplicates, while the local state/invoice/audit/lifecycle
      // transitions are serialized by this lock + conditioned update.
      await tx.$queryRaw`SELECT id FROM "SubscriptionPayment" WHERE id = ${payment.id} FOR UPDATE`;

      // Atomic, single-winner status transition: only a SUCCEEDED payment can be
      // refunded. Under concurrent refund requests exactly one transaction observes
      // SUCCEEDED and flips it to REFUNDED (also voiding the invoice and canceling
      // the subscription); any other request has its guarded update match no rows
      // and becomes an idempotent no-op. The money, the invoice, the audit event and
      // the subscription lifecycle transition therefore can never be performed twice.
      const flip = await tx.subscriptionPayment.updateMany({
        where: { id: payment.id, status: 'SUCCEEDED' },
        data: {
          status: 'REFUNDED',
          gatewayData: this.mergeGatewayData(payment.gatewayData, {
            status: 'REFUNDED',
            refundId,
            refundedAmount,
          }),
        },
      });

      if (flip.count === 0) {
        const current = await tx.subscriptionPayment.findUnique({ where: { id: payment.id } });
        return { payment: current ?? payment, voided: false };
      }

      // Reversal of the invoice: the subscription invoice is the financial record
      // created on success, so a full refund voids it exactly once.
      await tx.subscriptionInvoice.updateMany({
        where: { paymentId: payment.id, status: { not: 'VOID' } },
        data: { status: 'VOID' },
      });

      // F-3: A successful FULL refund cancels the subscription that the payment
      // activated. This happens atomically with the refund state update, only on the
      // single-winner path, so duplicate or out-of-order refund handling can never
      // repeat the lifecycle transition. It reuses the existing CANCELLED state (no
      // new state is invented) and is guarded to the active/past-due statuses so an
      // already-terminated subscription is left untouched. Failed refunds never reach
      // this point, so the subscription stays active in that case.
      await tx.subscription.updateMany({
        where: {
          ...(payment.subscriptionId
            ? { id: payment.subscriptionId }
            : { organizationId: payment.organizationId }),
          status: { in: ['ACTIVE', 'PAST_DUE'] },
        },
        data: { status: 'CANCELLED', canceledAt: new Date() },
      });

      return {
        payment: (await tx.subscriptionPayment.findUnique({ where: { id: payment.id } })) ?? payment,
        voided: true,
      };
    });

    // Only the single transition that actually performed the refund records the
    // audit event, keeping duplicate/concurrent refunds silent.
    if (updated.voided) {
      await this.auditService.record({
        organizationId: payment.organizationId,
        action: 'PAYMENT.REFUNDED',
        entity: 'SubscriptionPayment',
        entityId: payment.id,
        status: 'SUCCESS',
        metadata: { gateway: payment.gateway, refundId, refundedAmount },
      });
    }

    return this.buildVerifyResult(updated.payment, payment.organizationId);
  }

  private async findPaymentByWebhook(result: WebhookHandlingResult) {
    if (result.sessionRef) {
      const bySession = await this.prisma.subscriptionPayment.findFirst({
        where: { transactionRef: result.sessionRef },
      });
      if (bySession) return bySession;
    }
    if (result.transactionRef) {
      const byTxn = await this.prisma.subscriptionPayment.findFirst({
        where: { transactionRef: result.transactionRef },
      });
      if (byTxn) return byTxn;
    }
    return null;
  }

  private hasSeenEvent(payment: SubscriptionPayment, eventId: string): boolean {
    const data = (payment.gatewayData ?? {}) as Record<string, unknown>;
    const seen = Array.isArray(data.processedEvents) ? data.processedEvents : [];
    return seen.includes(eventId);
  }

  private mergeGatewayData(
    existing: Prisma.JsonValue | null,
    update: Record<string, unknown>,
  ): Prisma.InputJsonValue {
    const base = (existing ?? {}) as Record<string, unknown>;
    const data = { ...base, ...update };

    const eventId = update.eventId;
    if (typeof eventId === 'string' && eventId) {
      const seen = Array.isArray(base.processedEvents) ? base.processedEvents : [];
      data.processedEvents = [...new Set([...seen, eventId])];
    }
    return data as Prisma.InputJsonValue;
  }

  private async recordWebhookAudit(
    payment: SubscriptionPayment,
    result: WebhookHandlingResult,
  ): Promise<void> {
    await this.auditService.record({
      organizationId: payment.organizationId,
      action: `PAYMENT.WEBHOOK.${result.eventType.toUpperCase().replace(/\./g, '_')}`,
      entity: 'SubscriptionPayment',
      entityId: payment.id,
      status: 'SUCCESS',
      metadata: { gateway: payment.gateway, eventType: result.eventType, status: result.status },
    });
  }

  private async buildVerifyResult(
    payment: SubscriptionPayment,
    organizationId: string,
    subscription?: Record<string, unknown> | null,
    invoice?: Record<string, unknown> | null,
  ): Promise<VerifyResult> {
    if (!subscription || !invoice) {
      const loaded = await this.prisma.subscription.findUnique({
        where: { organizationId },
        include: { plan: true },
      });
      const loadedInvoice = await this.prisma.subscriptionInvoice.findFirst({
        where: { paymentId: payment.id },
      });
      return {
        payment: this.serializePayment(payment),
        subscription: loaded ? this.serializeSubscription(loaded) : null,
        invoice: loadedInvoice ? this.serializeInvoice(loadedInvoice) : null,
      };
    }
    return {
      payment: this.serializePayment(payment),
      subscription: subscription ? (subscription as Record<string, unknown>) : null,
      invoice: invoice ? (invoice as Record<string, unknown>) : null,
    };
  }

  private serializePayment(payment: SubscriptionPayment): Record<string, unknown> {
    return {
      id: payment.id,
      amount: Number(payment.amount),
      currency: payment.currency,
      billingInterval: payment.billingInterval,
      status: payment.status,
      gateway: payment.gateway,
      transactionRef: payment.transactionRef,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
    };
  }

  private serializeSubscription(subscription: {
    id: string;
    planId: string;
    status: string;
    billingInterval: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    trialEndsAt: Date | null;
    canceledAt: Date | null;
    plan: { id: string; name: string; slug: string };
  }): Record<string, unknown> {
    return {
      id: subscription.id,
      planId: subscription.planId,
      status: subscription.status,
      billingInterval: subscription.billingInterval,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialEndsAt: subscription.trialEndsAt,
      canceledAt: subscription.canceledAt,
      plan: {
        id: subscription.plan.id,
        name: subscription.plan.name,
        slug: subscription.plan.slug,
      },
    };
  }

  private serializeInvoice(invoice: {
    id: string;
    invoiceNumber: string;
    amount: { toString(): string };
    currency: string;
    billingInterval: string;
    status: string;
    issuedAt: Date;
    dueAt: Date | null;
    paidAt: Date | null;
    pdfUrl: string | null;
  }): Record<string, unknown> {
    return {
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
    };
  }
}
