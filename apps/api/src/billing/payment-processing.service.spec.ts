import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { GatewayRegistry } from './gateways/gateway-registry';
import { PaymentProcessingService } from './payment-processing.service';
import { BillingInterval } from './dto/billing.dto';

const orgId = 'org-1';
const userId = 'user-1';
const planId = 'plan-1';

const makePlan = (overrides: Record<string, unknown> = {}) => ({
  id: planId,
  name: 'Growth',
  slug: 'growth',
  description: 'Growth plan',
  price: 79,
  yearlyPrice: 790,
  currency: 'USD',
  interval: 'MONTHLY',
  freeTrialDays: 30,
  sortOrder: 1,
  isActive: true,
  ...overrides,
});

const makePayment = (overrides: Record<string, unknown> = {}) => ({
  id: 'pay-1',
  organizationId: orgId,
  planId,
  amount: 79,
  currency: 'USD',
  billingInterval: 'MONTHLY',
  status: 'PENDING',
  gateway: 'stripe',
  transactionRef: 'cs_1',
  paidAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  gatewayData: null,
  subscriptionId: null,
  ...overrides,
});

const makeSubscription = (overrides: Record<string, unknown> = {}) => ({
  id: 'sub-1',
  organizationId: orgId,
  planId,
  status: 'ACTIVE',
  billingInterval: 'MONTHLY',
  currentPeriodStart: new Date('2026-01-01T00:00:00Z'),
  currentPeriodEnd: new Date('2026-02-01T00:00:00Z'),
  trialEndsAt: null,
  canceledAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const makeInvoice = (overrides: Record<string, unknown> = {}) => ({
  id: 'inv-1',
  organizationId: orgId,
  subscriptionId: 'sub-1',
  paymentId: 'pay-1',
  invoiceNumber: 'INV-2026-0001',
  amount: 79,
  currency: 'USD',
  billingInterval: 'MONTHLY',
  status: 'PAID',
  issuedAt: new Date('2026-01-01T00:00:00Z'),
  dueAt: new Date('2026-01-01T00:00:00Z'),
  paidAt: new Date('2026-01-01T00:00:00Z'),
  pdfUrl: null,
  ...overrides,
});

const mockProvider = {
  code: 'stripe',
  isConfigured: jest.fn().mockReturnValue(true),
  createCheckoutSession: jest.fn(),
  verifyPayment: jest.fn(),
  handleWebhook: jest.fn(),
  refundPayment: jest.fn(),
};

const mockGatewayRegistry = {
  getWebUrl: jest.fn(),
  getActiveProvider: jest.fn(),
  getProviderByCode: jest.fn(),
};

const mockPrisma = {
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
  subscriptionPlan: { findUnique: jest.fn() },
  subscriptionPayment: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  subscription: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    updateMany: jest.fn(),
  },
  subscriptionInvoice: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockAuditService = { record: jest.fn() };

describe('PaymentProcessingService', () => {
  let service: PaymentProcessingService;

  beforeEach(async () => {
    jest.resetAllMocks();

    mockGatewayRegistry.getWebUrl.mockReturnValue('http://localhost:3000');
    mockGatewayRegistry.getActiveProvider.mockResolvedValue(mockProvider);
    mockGatewayRegistry.getProviderByCode.mockResolvedValue(mockProvider);

    mockPrisma.$queryRaw.mockResolvedValue([1]);
    mockPrisma.$transaction.mockImplementation(
      (callback: (tx: unknown) => unknown) => callback(mockPrisma),
    );
    mockPrisma.subscriptionInvoice.findMany.mockResolvedValue([]);
    mockPrisma.subscriptionPayment.updateMany.mockResolvedValue({ count: 1 });
    mockAuditService.record.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentProcessingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
        { provide: GatewayRegistry, useValue: mockGatewayRegistry },
      ],
    }).compile();

    service = module.get<PaymentProcessingService>(PaymentProcessingService);
  });

  describe('createCheckout', () => {
    it('creates a checkout session and a PENDING payment', async () => {
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(makePlan());
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(null);
      mockPrisma.subscriptionPayment.create.mockResolvedValue(makePayment());
      mockProvider.createCheckoutSession.mockResolvedValue({
        checkoutUrl: 'https://checkout.stripe.com/cs_1',
        sessionRef: 'cs_1',
        raw: { sessionId: 'cs_1' },
      });
      mockPrisma.subscriptionPayment.update.mockResolvedValue(makePayment({ transactionRef: 'cs_1' }));

      const result = await service.createCheckout(orgId, userId, planId, BillingInterval.MONTHLY);

      expect(result).toEqual({
        paymentId: 'pay-1',
        checkoutUrl: 'https://checkout.stripe.com/cs_1',
        gateway: 'stripe',
        sessionRef: 'cs_1',
      });
      expect(mockPrisma.subscriptionPayment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: orgId,
          planId,
          amount: 79,
          currency: 'USD',
          billingInterval: 'MONTHLY',
          status: 'PENDING',
          gateway: 'stripe',
        }),
      });
      expect(mockPrisma.subscriptionPayment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: expect.objectContaining({ transactionRef: 'cs_1' }),
      });
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYMENT.CHECKOUT_CREATED', entityId: 'pay-1' }),
      );
    });

    it('charges the yearly price for a yearly checkout', async () => {
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(makePlan());
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(null);
      mockPrisma.subscriptionPayment.create.mockResolvedValue(makePayment());
      mockProvider.createCheckoutSession.mockResolvedValue({
        checkoutUrl: 'https://checkout.stripe.com/cs_y',
        sessionRef: 'cs_y',
      });
      mockPrisma.subscriptionPayment.update.mockResolvedValue(makePayment());

      await service.createCheckout(orgId, userId, planId, BillingInterval.YEARLY);

      expect(mockPrisma.subscriptionPayment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ amount: 790, billingInterval: 'YEARLY' }),
      });
      expect(mockProvider.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 790, billingInterval: 'YEARLY' }),
      );
    });

    it('rejects an unknown plan', async () => {
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(null);
      await expect(service.createCheckout(orgId, userId, planId)).rejects.toThrow(NotFoundException);
    });

    it('rejects an inactive plan', async () => {
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(makePlan({ isActive: false }));
      await expect(service.createCheckout(orgId, userId, planId)).rejects.toThrow(BadRequestException);
    });

    it('prevents duplicate checkouts by reusing an existing PENDING payment', async () => {
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(makePlan());
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(makePayment());
      mockProvider.createCheckoutSession.mockResolvedValue({
        checkoutUrl: 'https://checkout.stripe.com/cs_1',
        sessionRef: 'cs_1',
      });
      mockPrisma.subscriptionPayment.update.mockResolvedValue(makePayment({ transactionRef: 'cs_1' }));

      const result = await service.createCheckout(orgId, userId, planId, BillingInterval.MONTHLY);

      expect(mockPrisma.subscriptionPayment.create).not.toHaveBeenCalled();
      expect(mockPrisma.subscriptionPayment.findFirst).toHaveBeenCalledWith({
        where: {
          organizationId: orgId,
          planId,
          billingInterval: 'MONTHLY',
          status: 'PENDING',
          gateway: 'stripe',
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(mockPrisma.subscriptionPayment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: expect.anything(),
      });
      expect(result.paymentId).toBe('pay-1');
    });

    it('passes success and cancel URLs into the provider', async () => {
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(makePlan());
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(null);
      mockPrisma.subscriptionPayment.create.mockResolvedValue(makePayment());
      mockProvider.createCheckoutSession.mockResolvedValue({
        checkoutUrl: 'https://checkout.stripe.com/cs_1',
        sessionRef: 'cs_1',
      });
      mockPrisma.subscriptionPayment.update.mockResolvedValue(makePayment());

      await service.createCheckout(orgId, userId, planId, BillingInterval.MONTHLY);

      expect(mockProvider.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          successUrl: expect.stringContaining('session_status=success'),
          cancelUrl: expect.stringContaining('session_status=cancelled'),
        }),
      );
    });

    it('uses provider.resolveAmount to derive the charged amount and currency', async () => {
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(makePlan());
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(null);
      mockPrisma.subscriptionPayment.create.mockResolvedValue(
        makePayment({ amount: 16390, currency: 'BDT' }),
      );
      (mockProvider as { resolveAmount?: jest.Mock }).resolveAmount = jest.fn(() => ({
        amount: 16390,
        currency: 'BDT',
      }));
      const resolveAmountMock = (mockProvider as unknown as { resolveAmount: jest.Mock }).resolveAmount;
      mockProvider.createCheckoutSession.mockResolvedValue({
        checkoutUrl: 'https://checkout.example/api.php',
        sessionRef: 'cs_1',
      });
      mockPrisma.subscriptionPayment.update.mockResolvedValue(makePayment());

      await service.createCheckout(orgId, userId, planId, BillingInterval.MONTHLY);

      expect(resolveAmountMock).toHaveBeenCalledWith({ amount: 79, currency: 'USD' });
      expect(mockPrisma.subscriptionPayment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ amount: 16390, currency: 'BDT' }),
      });
      expect(mockProvider.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 16390, currency: 'BDT' }),
      );
    });
  });

  describe('verifyPayment', () => {
    it('forwards a provider valId and persists it for idempotent recovery', async () => {
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(makePayment());
      mockProvider.verifyPayment.mockResolvedValue({
        verified: false,
        status: 'PENDING',
        transactionRef: null,
      });
      mockPrisma.subscriptionPayment.update.mockResolvedValue(makePayment());

      const result = await service.verifyPayment(orgId, userId, 'pay-1', { valId: 'val-9' });

      expect(mockPrisma.subscriptionPayment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: expect.objectContaining({ gatewayData: expect.objectContaining({ valId: 'val-9' }) }),
      });
      expect(mockProvider.verifyPayment).toHaveBeenCalledWith(
        expect.objectContaining({ valId: 'val-9' }),
      );
      expect(result.payment.status).toBe('PENDING');
    });
    it('returns immediately for an already-succeeded payment', async () => {
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(makePayment({ status: 'SUCCEEDED' }));
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      mockPrisma.subscriptionInvoice.findFirst.mockResolvedValue(null);

      const result = await service.verifyPayment(orgId, userId, 'pay-1');

      expect(mockProvider.verifyPayment).not.toHaveBeenCalled();
      expect(result.payment.status).toBe('SUCCEEDED');
    });

    it('finalizes a succeeded payment, activates the subscription and creates an invoice', async () => {
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(makePayment());
      mockProvider.verifyPayment.mockResolvedValue({
        verified: true,
        status: 'SUCCEEDED',
        transactionRef: 'pi_1',
        raw: { paymentIntentId: 'pi_1' },
      });
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValue(makePayment());
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(makePlan());
      mockPrisma.subscription.upsert.mockResolvedValue(makeSubscription());
      mockPrisma.subscriptionInvoice.create.mockResolvedValue(makeInvoice());
      mockPrisma.subscriptionPayment.update.mockResolvedValue(
        makePayment({ status: 'SUCCEEDED', subscriptionId: 'sub-1', transactionRef: 'pi_1' }),
      );

      const result = await service.verifyPayment(orgId, userId, 'pay-1');

      expect(mockProvider.verifyPayment).toHaveBeenCalledWith(
        expect.objectContaining({ sessionRef: 'cs_1' }),
      );
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: orgId },
          create: expect.objectContaining({
            planId,
            status: 'ACTIVE',
            billingInterval: 'MONTHLY',
          }),
          update: expect.objectContaining({ status: 'ACTIVE', trialEndsAt: null, canceledAt: null }),
        }),
      );
      expect(mockPrisma.subscriptionInvoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PAID',
            paymentId: 'pay-1',
            subscriptionId: 'sub-1',
            invoiceNumber: expect.stringMatching(/^INV-\d{4}-0001$/),
          }),
        }),
      );
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYMENT.SUCCEEDED' }),
      );
      expect(result.payment.status).toBe('SUCCEEDED');
      expect(result.subscription).toEqual(expect.objectContaining({ status: 'ACTIVE' }));
      expect(result.invoice).toEqual(expect.objectContaining({ status: 'PAID' }));
    });

    it('increments the invoice sequence for the same organization', async () => {
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(makePayment());
      mockProvider.verifyPayment.mockResolvedValue({
        verified: true,
        status: 'SUCCEEDED',
        transactionRef: 'pi_1',
      });
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValue(makePayment());
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(makePlan());
      mockPrisma.subscription.upsert.mockResolvedValue(makeSubscription());
      mockPrisma.subscriptionInvoice.findMany.mockResolvedValue([
        { invoiceNumber: 'INV-2026-0001' },
        { invoiceNumber: 'INV-2026-0002' },
      ]);
      mockPrisma.subscriptionInvoice.create.mockResolvedValue(
        makeInvoice({ invoiceNumber: 'INV-2026-0003' }),
      );
      mockPrisma.subscriptionPayment.update.mockResolvedValue(makePayment({ status: 'SUCCEEDED' }));

      await service.verifyPayment(orgId, userId, 'pay-1');

      expect(mockPrisma.subscriptionInvoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ invoiceNumber: 'INV-2026-0003' }),
        }),
      );
    });

    it('holds the payment PENDING when the gateway has not confirmed it yet', async () => {
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(makePayment());
      mockProvider.verifyPayment.mockResolvedValue({
        verified: false,
        status: 'PENDING',
        transactionRef: null,
      });
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      mockPrisma.subscriptionInvoice.findFirst.mockResolvedValue(null);

      const result = await service.verifyPayment(orgId, userId, 'pay-1');

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(result.payment.status).toBe('PENDING');
    });

    it('marks the payment FAILED and reflects it in the response', async () => {
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(makePayment());
      mockProvider.verifyPayment.mockResolvedValue({
        verified: false,
        status: 'FAILED',
        transactionRef: null,
      });
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValue(makePayment({ status: 'FAILED' }));
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      mockPrisma.subscriptionInvoice.findFirst.mockResolvedValue(null);

      const result = await service.verifyPayment(orgId, userId, 'pay-1');

      expect(mockPrisma.subscriptionPayment.updateMany).toHaveBeenCalledWith({
        where: { id: 'pay-1', status: 'PENDING' },
        data: expect.objectContaining({ status: 'FAILED' }),
      });
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYMENT.FAILED' }),
      );
      expect(result.payment.status).toBe('FAILED');
    });

    it('marks the payment CANCELLED and reflects it in the response', async () => {
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(makePayment());
      mockProvider.verifyPayment.mockResolvedValue({
        verified: false,
        status: 'CANCELLED',
        transactionRef: null,
      });
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValue(makePayment({ status: 'CANCELLED' }));
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      mockPrisma.subscriptionInvoice.findFirst.mockResolvedValue(null);

      const result = await service.verifyPayment(orgId, userId, 'pay-1');

      expect(mockPrisma.subscriptionPayment.updateMany).toHaveBeenCalledWith({
        where: { id: 'pay-1', status: 'PENDING' },
        data: expect.objectContaining({ status: 'CANCELLED' }),
      });
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYMENT.CANCELLED' }),
      );
      expect(result.payment.status).toBe('CANCELLED');
    });

    it('does not overwrite a payment that is no longer PENDING', async () => {
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(makePayment());
      mockProvider.verifyPayment.mockResolvedValue({
        verified: false,
        status: 'FAILED',
        transactionRef: null,
      });
      mockPrisma.subscriptionPayment.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      mockPrisma.subscriptionInvoice.findFirst.mockResolvedValue(null);

      const result = await service.verifyPayment(orgId, userId, 'pay-1');

      expect(mockPrisma.subscriptionPayment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'pay-1', status: 'PENDING' } }),
      );
      expect(mockAuditService.record).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYMENT.FAILED' }),
      );
      expect(result.payment.status).toBe('PENDING');
    });

    it('rejects an unknown payment', async () => {
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(null);
      await expect(service.verifyPayment(orgId, userId, 'pay-missing')).rejects.toThrow(NotFoundException);
    });

    it('rejects a payment without a gateway', async () => {
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(makePayment({ gateway: null }));
      await expect(service.verifyPayment(orgId, userId, 'pay-1')).rejects.toThrow(BadRequestException);
    });

    it('rejects a payment without a session reference', async () => {
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(makePayment({ transactionRef: null }));
      await expect(service.verifyPayment(orgId, userId, 'pay-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('handleWebhook', () => {
    it('activates the subscription for a succeeded checkout event', async () => {
      mockProvider.handleWebhook.mockResolvedValue({
        handled: true,
        eventType: 'checkout.session.completed',
        status: 'SUCCEEDED',
        sessionRef: 'cs_1',
        transactionRef: 'pi_1',
        metadata: { eventId: 'evt_1' },
        raw: { sessionId: 'cs_1' },
      });
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(makePayment());
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValue(makePayment());
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(makePlan());
      mockPrisma.subscription.upsert.mockResolvedValue(makeSubscription());
      mockPrisma.subscriptionInvoice.create.mockResolvedValue(makeInvoice());
      mockPrisma.subscriptionPayment.update.mockResolvedValue(
        makePayment({ status: 'SUCCEEDED', subscriptionId: 'sub-1' }),
      );

      const result = await service.handleWebhook('stripe', '{}', {});

      expect(result).toEqual({ received: true, handled: true, eventType: 'checkout.session.completed' });
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ status: 'ACTIVE' }) }),
      );
      expect(mockPrisma.subscriptionInvoice.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PAID' }) }),
      );
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYMENT.WEBHOOK.CHECKOUT_SESSION_COMPLETED' }),
      );
    });

    it('ignores duplicate webhook deliveries for the same event id', async () => {
      mockProvider.handleWebhook.mockResolvedValue({
        handled: true,
        eventType: 'checkout.session.completed',
        status: 'SUCCEEDED',
        sessionRef: 'cs_1',
        transactionRef: 'pi_1',
        metadata: { eventId: 'evt_1' },
      });
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(
        makePayment({ gatewayData: { processedEvents: ['evt_1'] } }),
      );

      const result = await service.handleWebhook('stripe', '{}', {});

      expect(result).toEqual({ received: true, handled: true, eventType: 'checkout.session.completed', duplicate: true });
      expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
      expect(mockAuditService.record).not.toHaveBeenCalled();
    });

    it('dedupes a duplicate SSLCommerz IPN (same val_id:status event id)', async () => {
      // First delivery succeeded, marking the payment with the processed event.
      mockProvider.handleWebhook.mockResolvedValue({
        handled: true,
        eventType: 'ipn.payment_success',
        status: 'SUCCEEDED',
        sessionRef: 'pay-1',
        transactionRef: 'bank-ref-9',
        metadata: { eventId: 'val-123:VALID' },
        raw: { valId: 'val-123' },
      });
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(
        makePayment({ gatewayData: { processedEvents: ['val-123:VALID'] } }),
      );

      const result = await service.handleWebhook('sslcommerz', 'status=VALID&val_id=val-123&tran_id=pay-1', {});

      expect(result).toEqual({ received: true, handled: true, eventType: 'ipn.payment_success', duplicate: true });
      // No duplicate subscription activation, invoice, or audit on re-delivery.
      expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.subscriptionInvoice.create).not.toHaveBeenCalled();
      expect(mockAuditService.record).not.toHaveBeenCalled();
    });

    it('acknowledges but ignores unhandled events', async () => {
      mockProvider.handleWebhook.mockResolvedValue({
        handled: false,
        eventType: 'charge.refunded',
        raw: { chargeId: 'ch_1' },
      });

      const result = await service.handleWebhook('stripe', '{}', {});

      expect(result).toEqual({ received: true, handled: false, eventType: 'charge.refunded' });
      expect(mockPrisma.subscriptionPayment.findFirst).not.toHaveBeenCalled();
    });

    it('acknowledges events referencing an unknown payment', async () => {
      mockProvider.handleWebhook.mockResolvedValue({
        handled: true,
        eventType: 'checkout.session.completed',
        status: 'SUCCEEDED',
        sessionRef: 'cs_unknown',
        metadata: { eventId: 'evt_x' },
      });
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(null);

      const result = await service.handleWebhook('stripe', '{}', {});

      expect(result).toEqual({
        received: true,
        handled: false,
        eventType: 'checkout.session.completed',
        reason: 'unknown-payment',
      });
      expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
    });

    it('voids the invoice for a fully refunded charge event', async () => {
      mockProvider.handleWebhook.mockResolvedValue({
        handled: true,
        eventType: 'charge.refunded',
        status: 'REFUNDED',
        sessionRef: 'cs_1',
        transactionRef: 'pi_1',
        metadata: { eventId: 'evt_2', refundId: 're_1' },
        raw: { chargeId: 'ch_1' },
      });
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(makePayment());
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValue(makePayment({ status: 'SUCCEEDED' }));
      mockPrisma.subscriptionInvoice.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.subscriptionPayment.update.mockResolvedValue(makePayment({ status: 'REFUNDED' }));

      const result = await service.handleWebhook('stripe', '{}', {});

      expect(result).toEqual({ received: true, handled: true, eventType: 'charge.refunded' });
      expect(mockPrisma.subscriptionInvoice.updateMany).toHaveBeenCalledWith({
        where: { paymentId: 'pay-1', status: { not: 'VOID' } },
        data: { status: 'VOID' },
      });
      expect(mockPrisma.subscriptionPayment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-1', status: 'SUCCEEDED' },
          data: expect.objectContaining({ status: 'REFUNDED' }),
        }),
      );
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYMENT.REFUNDED' }),
      );
      // F-3: a successful full refund also cancels the subscription.
      expect(mockPrisma.subscription.updateMany).toHaveBeenCalledWith({
        where: {
          organizationId: orgId,
          status: { in: ['ACTIVE', 'PAST_DUE'] },
        },
        data: { status: 'CANCELLED', canceledAt: expect.any(Date) },
      });
    });

    it('ignores a refund event when the payment is not yet succeeded', async () => {
      mockProvider.handleWebhook.mockResolvedValue({
        handled: true,
        eventType: 'charge.refunded',
        status: 'REFUNDED',
        sessionRef: 'cs_1',
        transactionRef: 'pi_1',
        metadata: { eventId: 'evt_2', refundId: 're_1' },
      });
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(makePayment());
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValue(makePayment({ status: 'PENDING' }));
      mockPrisma.subscriptionPayment.updateMany.mockResolvedValue({ count: 0 });

      await service.handleWebhook('stripe', '{}', {});

      expect(mockPrisma.subscriptionPayment.update).not.toHaveBeenCalled();
      expect(mockPrisma.subscriptionInvoice.updateMany).not.toHaveBeenCalled();
    });

    it('marks the payment FAILED on an async payment failed event', async () => {
      mockProvider.handleWebhook.mockResolvedValue({
        handled: true,
        eventType: 'checkout.session.async_payment_failed',
        status: 'FAILED',
        sessionRef: 'cs_1',
        metadata: { eventId: 'evt_3' },
      });
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(makePayment());
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValue(makePayment({ status: 'FAILED' }));

      const result = await service.handleWebhook('stripe', '{}', {});

      expect(mockPrisma.subscriptionPayment.updateMany).toHaveBeenCalledWith({
        where: { id: 'pay-1', status: 'PENDING' },
        data: expect.objectContaining({ status: 'FAILED' }),
      });
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYMENT.FAILED' }),
      );
      expect(result).toEqual({ received: true, handled: true, eventType: 'checkout.session.async_payment_failed' });
    });

    it('marks the payment CANCELLED on a session expired event', async () => {
      mockProvider.handleWebhook.mockResolvedValue({
        handled: true,
        eventType: 'checkout.session.expired',
        status: 'CANCELLED',
        sessionRef: 'cs_1',
        metadata: { eventId: 'evt_4' },
      });
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(makePayment());
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValue(makePayment({ status: 'CANCELLED' }));

      await service.handleWebhook('stripe', '{}', {});

      expect(mockPrisma.subscriptionPayment.updateMany).toHaveBeenCalledWith({
        where: { id: 'pay-1', status: 'PENDING' },
        data: expect.objectContaining({ status: 'CANCELLED' }),
      });
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYMENT.CANCELLED' }),
      );
    });

    it('does not fail a payment that is already succeeded', async () => {
      mockProvider.handleWebhook.mockResolvedValue({
        handled: true,
        eventType: 'checkout.session.async_payment_failed',
        status: 'FAILED',
        sessionRef: 'cs_1',
        metadata: { eventId: 'evt_5' },
      });
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(makePayment());
      mockPrisma.subscriptionPayment.updateMany.mockResolvedValue({ count: 0 });

      await service.handleWebhook('stripe', '{}', {});

      expect(mockPrisma.subscriptionPayment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'pay-1', status: 'PENDING' } }),
      );
      expect(mockAuditService.record).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYMENT.FAILED' }),
      );
    });
  });

  describe('refundPayment', () => {
    it('refunds a succeeded payment, voids the invoice and cancels the subscription', async () => {
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(
        makePayment({ status: 'SUCCEEDED', transactionRef: 'pi_1', subscriptionId: 'sub-1' }),
      );
      mockProvider.refundPayment.mockResolvedValue({
        refunded: true,
        refundRef: 're_1',
        raw: { refundId: 're_1', status: 'succeeded' },
      });
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValue(makePayment({ status: 'REFUNDED' }));
      mockPrisma.subscriptionInvoice.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.subscriptionPayment.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.refundPayment(orgId, userId, 'pay-1');

      expect(mockProvider.refundPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          payment: expect.objectContaining({ id: 'pay-1', transactionRef: 'pi_1' }),
          amount: 79,
          idempotencyKey: 'refund:pay-1',
        }),
      );
      // F-2: the payment row is locked (FOR UPDATE) before the guarded transition.
      expect(mockPrisma.$queryRaw.mock.calls[0][0].join('')).toContain('FOR UPDATE');
      expect(mockPrisma.subscriptionInvoice.updateMany).toHaveBeenCalledWith({
        where: { paymentId: 'pay-1', status: { not: 'VOID' } },
        data: { status: 'VOID' },
      });
      expect(mockPrisma.subscriptionPayment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-1', status: 'SUCCEEDED' },
          data: expect.objectContaining({ status: 'REFUNDED' }),
        }),
      );
      // F-3: a successful full refund cancels the activated subscription, atomically.
      expect(mockPrisma.subscription.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'sub-1',
          status: { in: ['ACTIVE', 'PAST_DUE'] },
        },
        data: { status: 'CANCELLED', canceledAt: expect.any(Date) },
      });
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYMENT.REFUNDED' }),
      );
      expect(result.payment.status).toBe('REFUNDED');
    });

    it('serializes concurrent refunds with a db row lock before the guarded transition', async () => {
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(
        makePayment({ status: 'SUCCEEDED', transactionRef: 'pi_1', subscriptionId: 'sub-1' }),
      );
      mockProvider.refundPayment.mockResolvedValue({ refunded: true, refundRef: 're_1' });
      mockPrisma.subscriptionPayment.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValue(makePayment({ status: 'REFUNDED' }));

      await service.refundPayment(orgId, userId, 'pay-1');

      // F-2: verify the payment row was locked (FOR UPDATE) for serialization.
      const lockCalled = mockPrisma.$queryRaw.mock.calls.some(
        (c) => String(c?.[0]?.join?.('') ?? '').includes('FOR UPDATE'),
      );
      expect(lockCalled).toBe(true);
    });

    it('cancels the subscription by organization when the payment has no subscription link', async () => {
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(
        makePayment({ status: 'SUCCEEDED', transactionRef: 'pi_1' }),
      );
      mockProvider.refundPayment.mockResolvedValue({ refunded: true, refundRef: 're_1' });
      mockPrisma.subscriptionPayment.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValue(makePayment({ status: 'REFUNDED' }));

      await service.refundPayment(orgId, userId, 'pay-1');

      expect(mockPrisma.subscription.updateMany).toHaveBeenCalledWith({
        where: {
          organizationId: orgId,
          status: { in: ['ACTIVE', 'PAST_DUE'] },
        },
        data: { status: 'CANCELLED', canceledAt: expect.any(Date) },
      });
    });

    it('rejects a refund for a non-succeeded payment', async () => {
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(makePayment({ status: 'PENDING' }));

      await expect(service.refundPayment(orgId, userId, 'pay-1')).rejects.toThrow(BadRequestException);
      expect(mockProvider.refundPayment).not.toHaveBeenCalled();
    });

    it('rejects a refund when the gateway does not confirm it', async () => {
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(
        makePayment({ status: 'SUCCEEDED', transactionRef: 'pi_1' }),
      );
      mockProvider.refundPayment.mockResolvedValue({ refunded: false, refundRef: null });

      await expect(service.refundPayment(orgId, userId, 'pay-1')).rejects.toThrow(BadRequestException);
      expect(mockPrisma.subscriptionPayment.update).not.toHaveBeenCalled();
      // F-3: a failed refund must not deactivate the subscription.
      expect(mockPrisma.subscription.updateMany).not.toHaveBeenCalled();
      expect(mockAuditService.record).not.toHaveBeenCalled();
    });

    it('does not deactivate the subscription when the first attempt fails, then succeeds on retry', async () => {
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(
        makePayment({ status: 'SUCCEEDED', transactionRef: 'pi_1', subscriptionId: 'sub-1' }),
      );
      mockProvider.refundPayment
        .mockResolvedValueOnce({ refunded: false, refundRef: null })
        .mockResolvedValueOnce({ refunded: true, refundRef: 're_1', raw: { refundId: 're_1' } });
      mockPrisma.subscriptionPayment.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValue(makePayment({ status: 'REFUNDED' }));

      await expect(service.refundPayment(orgId, userId, 'pay-1')).rejects.toThrow(BadRequestException);
      expect(mockPrisma.subscription.updateMany).not.toHaveBeenCalled();

      await service.refundPayment(orgId, userId, 'pay-1');

      expect(mockPrisma.subscription.updateMany).toHaveBeenCalledWith({
        where: { id: 'sub-1', status: { in: ['ACTIVE', 'PAST_DUE'] } },
        data: { status: 'CANCELLED', canceledAt: expect.any(Date) },
      });
      expect(mockProvider.refundPayment).toHaveBeenCalledTimes(2);
    });

    it('does not repeat the lifecycle transition on a duplicate refund (already refunded)', async () => {
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(
        makePayment({ status: 'REFUNDED', transactionRef: 'pi_1' }),
      );

      await expect(service.refundPayment(orgId, userId, 'pay-1')).rejects.toThrow(BadRequestException);
      expect(mockProvider.refundPayment).not.toHaveBeenCalled();
      expect(mockPrisma.subscription.updateMany).not.toHaveBeenCalled();
    });

    it('does not touch an already-cancelled or expired subscription', async () => {
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(
        makePayment({ status: 'SUCCEEDED', transactionRef: 'pi_1', subscriptionId: 'sub-1' }),
      );
      mockProvider.refundPayment.mockResolvedValue({ refunded: true, refundRef: 're_1' });
      mockPrisma.subscriptionPayment.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValue(makePayment({ status: 'REFUNDED' }));
      // Simulate an already-cancelled subscription.
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 0 });

      await service.refundPayment(orgId, userId, 'pay-1');

      // The updateMany fires but matches 0 rows (status not in ACTIVE/PAST_DUE), so no state change.
      expect(mockPrisma.subscription.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'sub-1',
          status: { in: ['ACTIVE', 'PAST_DUE'] },
        },
        data: { status: 'CANCELLED', canceledAt: expect.any(Date) },
      });
    });

    it('rejects a refund for an unknown payment', async () => {
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(null);
      await expect(service.refundPayment(orgId, userId, 'pay-missing')).rejects.toThrow(NotFoundException);
    });

    it('scopes the lookup to the organization (org isolation)', async () => {
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(null);
      await expect(service.refundPayment('other-org', userId, 'pay-1')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.subscriptionPayment.findFirst).toHaveBeenCalledWith({
        where: { id: 'pay-1', organizationId: 'other-org' },
      });
    });

    it('rejects a refund amount that exceeds the original payment', async () => {
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(
        makePayment({ status: 'SUCCEEDED', transactionRef: 'pi_1' }),
      );

      await expect(service.refundPayment(orgId, userId, 'pay-1', 99.99)).rejects.toThrow(BadRequestException);
      expect(mockProvider.refundPayment).not.toHaveBeenCalled();
    });

    it('rejects a partial refund amount (not fully supported by the schema)', async () => {
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(
        makePayment({ status: 'SUCCEEDED', transactionRef: 'pi_1' }),
      );

      await expect(service.refundPayment(orgId, userId, 'pay-1', 39)).rejects.toThrow(BadRequestException);
      expect(mockProvider.refundPayment).not.toHaveBeenCalled();
    });

    it('rejects a non-positive refund amount', async () => {
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(
        makePayment({ status: 'SUCCEEDED', transactionRef: 'pi_1' }),
      );

      await expect(service.refundPayment(orgId, userId, 'pay-1', 0)).rejects.toThrow(BadRequestException);
      await expect(service.refundPayment(orgId, userId, 'pay-1', -5)).rejects.toThrow(BadRequestException);
      expect(mockProvider.refundPayment).not.toHaveBeenCalled();
    });

    it('is idempotent when the payment is already refunded (no re-void, no second audit)', async () => {
      mockProvider.handleWebhook.mockResolvedValue({
        handled: true,
        eventType: 'charge.refunded',
        status: 'REFUNDED',
        sessionRef: 'cs_1',
        transactionRef: 'pi_1',
        metadata: { eventId: 'evt_dup', refundId: 're_1' },
      });
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(makePayment({ status: 'REFUNDED' }));
      mockPrisma.subscriptionPayment.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValue(makePayment({ status: 'REFUNDED' }));

      await service.handleWebhook('stripe', '{}', {});

      expect(mockPrisma.subscriptionInvoice.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.subscription.updateMany).not.toHaveBeenCalled();
      expect(mockAuditService.record).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYMENT.REFUNDED' }),
      );
    });

    it('records the refunded amount and refund id in gateway data on refund', async () => {
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(
        makePayment({ status: 'SUCCEEDED', transactionRef: 'pi_1' }),
      );
      mockProvider.refundPayment.mockResolvedValue({
        refunded: true,
        refundRef: 're_1',
        raw: { refundId: 're_1', status: 'succeeded' },
      });
      mockPrisma.subscriptionPayment.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValue(makePayment({ status: 'REFUNDED' }));

      await service.refundPayment(orgId, userId, 'pay-1');

      expect(mockPrisma.subscriptionPayment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            gatewayData: expect.objectContaining({
              status: 'REFUNDED',
              refundId: 're_1',
              refundedAmount: 79,
            }),
          }),
        }),
      );
    });
  });

  describe('D-B3: invoice number concurrency (P2002 retry)', () => {
    const year = new Date().getFullYear();

    function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
      return new Prisma.PrismaClientKnownRequestError(`Unique constraint failed (${code})`, {
        code,
        clientVersion: '5.0.0',
        meta: { target: ['organizationId', 'invoiceNumber'] },
      });
    }

    function setupSuccessfulVerify() {
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(makePayment());
      mockProvider.verifyPayment.mockResolvedValue({
        verified: true,
        status: 'SUCCEEDED',
        transactionRef: 'pi_1',
        raw: { paymentIntentId: 'pi_1' },
      });
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValue(makePayment());
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(makePlan());
      mockPrisma.subscription.upsert.mockResolvedValue(makeSubscription());
      mockPrisma.subscriptionPayment.update.mockResolvedValue(
        makePayment({ status: 'SUCCEEDED', subscriptionId: 'sub-1', transactionRef: 'pi_1' }),
      );
    }

    it('sequential invoice generation uses incrementing sequence numbers', async () => {
      setupSuccessfulVerify();
      mockPrisma.subscriptionInvoice.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ invoiceNumber: `INV-${year}-0001` }]);
      mockPrisma.subscriptionInvoice.create
        .mockResolvedValueOnce(makeInvoice({ invoiceNumber: `INV-${year}-0001` }))
        .mockResolvedValueOnce(makeInvoice({ invoiceNumber: `INV-${year}-0002` }));

      await service.verifyPayment(orgId, userId, 'pay-1');
      expect(mockPrisma.subscriptionInvoice.create).toHaveBeenNthCalledWith(1,
        expect.objectContaining({ data: expect.objectContaining({ invoiceNumber: `INV-${year}-0001` }) }),
      );

      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(makePayment({ id: 'pay-2' }));
      mockProvider.verifyPayment.mockResolvedValue({
        verified: true,
        status: 'SUCCEEDED',
        transactionRef: 'pi_2',
        raw: { paymentIntentId: 'pi_2' },
      });
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValue(makePayment({ id: 'pay-2' }));
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(makePlan());
      mockPrisma.subscription.upsert.mockResolvedValue(makeSubscription());
      mockPrisma.subscriptionPayment.update.mockResolvedValue(
        makePayment({ id: 'pay-2', status: 'SUCCEEDED', subscriptionId: 'sub-1', transactionRef: 'pi_2' }),
      );

      await service.verifyPayment(orgId, userId, 'pay-2');
      expect(mockPrisma.subscriptionInvoice.create).toHaveBeenNthCalledWith(2,
        expect.objectContaining({ data: expect.objectContaining({ invoiceNumber: `INV-${year}-0002` }) }),
      );
    });

    it('retries on a P2002 collision and succeeds with a regenerated number', async () => {
      setupSuccessfulVerify();
      mockPrisma.subscriptionInvoice.findMany.mockResolvedValue([]);
      mockPrisma.subscriptionInvoice.create
        .mockRejectedValueOnce(prismaError('P2002'))
        .mockResolvedValueOnce(makeInvoice({ invoiceNumber: `INV-${year}-0001` }));

      const result = await service.verifyPayment(orgId, userId, 'pay-1');

      expect(mockPrisma.subscriptionInvoice.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.subscriptionInvoice.create).toHaveBeenNthCalledWith(1,
        expect.objectContaining({ data: expect.objectContaining({ invoiceNumber: `INV-${year}-0001` }) }),
      );
      expect(result.payment.status).toBe('SUCCEEDED');
    });

    it('throws InternalServerErrorException after max retries exhausted', async () => {
      setupSuccessfulVerify();
      mockPrisma.subscriptionInvoice.findMany.mockResolvedValue([]);
      mockPrisma.subscriptionInvoice.create.mockRejectedValue(prismaError('P2002'));

      await expect(service.verifyPayment(orgId, userId, 'pay-1')).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(mockPrisma.subscriptionInvoice.create).toHaveBeenCalledTimes(5);
    });

    it('does not retry non-P2002 Prisma errors', async () => {
      setupSuccessfulVerify();
      mockPrisma.subscriptionInvoice.findMany.mockResolvedValue([]);
      const otherErr = new Prisma.PrismaClientKnownRequestError('Connection interrupted', {
        code: 'P2024',
        clientVersion: '5.0.0',
        meta: {},
      });
      mockPrisma.subscriptionInvoice.create.mockRejectedValue(otherErr);

      await expect(service.verifyPayment(orgId, userId, 'pay-1')).rejects.toThrow(
        'Connection interrupted',
      );
      expect(mockPrisma.subscriptionInvoice.create).toHaveBeenCalledTimes(1);
    });

    it('scopes invoice numbering to the organization', async () => {
      setupSuccessfulVerify();
      mockPrisma.subscriptionInvoice.findMany.mockResolvedValue([
        { invoiceNumber: `INV-${year}-0001` },
        { invoiceNumber: `INV-${year}-0002` },
      ]);
      mockPrisma.subscriptionInvoice.create.mockResolvedValue(
        makeInvoice({ invoiceNumber: `INV-${year}-0003` }),
      );

      await service.verifyPayment(orgId, userId, 'pay-1');

      expect(mockPrisma.subscriptionInvoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            invoiceNumber: `INV-${year}-0003`,
            organizationId: orgId,
          }),
        }),
      );
      expect(mockPrisma.subscriptionInvoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: orgId } }),
      );
    });

    it('existing invoice/payment behavior remains unchanged after retry logic', async () => {
      setupSuccessfulVerify();
      mockPrisma.subscriptionInvoice.findMany.mockResolvedValue([]);
      mockPrisma.subscriptionInvoice.create.mockResolvedValue(makeInvoice());

      const result = await service.verifyPayment(orgId, userId, 'pay-1');

      expect(result.payment.status).toBe('SUCCEEDED');
      expect(result.subscription).toEqual(expect.objectContaining({ status: 'ACTIVE' }));
      expect(result.invoice).toEqual(expect.objectContaining({ status: 'PAID' }));
      expect(mockPrisma.subscriptionPayment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SUCCEEDED', subscriptionId: 'sub-1' }),
        }),
      );
    });
  });
});
