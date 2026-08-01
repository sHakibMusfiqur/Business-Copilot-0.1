import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import Stripe from 'stripe';

import { ConfigService } from '../../config/config.service';
import type {
  CheckoutSessionInput,
  CheckoutSessionResult,
  GatewayConfig,
  PaymentGateway,
  PaymentVerificationResult,
  RefundPaymentInput,
  RefundPaymentResult,
  VerifyPaymentInput,
  WebhookHandlingResult,
  WebhookInput,
} from './payment-gateway.interface';

/**
 * Stripe provider backed by the official stripe-node SDK.
 *
 * Configuration keys (read from the `PaymentGateway.config` JSON column):
 *   - secretKey       (falls back to STRIPE_SECRET_KEY)
 *   - publishableKey  (falls back to STRIPE_PUBLISHABLE_KEY)
 *   - webhookSecret   (falls back to STRIPE_WEBHOOK_SECRET)
 */
@Injectable()
export class StripeProvider implements PaymentGateway {
  readonly code = 'stripe';

  private readonly logger = new Logger(StripeProvider.name);
  private readonly client: Stripe | null;
  private readonly webhookSecret: string;

  constructor(
    config: GatewayConfig,
    private readonly configService: ConfigService,
  ) {
    const secretKey = (config.secretKey as string | undefined) || this.configService.stripeSecretKey;
    this.webhookSecret = (config.webhookSecret as string | undefined) || this.configService.stripeWebhookSecret;
    this.client = secretKey ? new Stripe(secretKey) : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    const client = this.requireClient();
    const session = await client.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: Math.round(input.amount * 100),
            product_data: {
              name: `${input.planName} (${input.billingInterval})`,
              description: `Business Copilot ${input.planName} subscription`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.paymentId,
      metadata: {
        paymentId: input.paymentId,
        organizationId: input.organizationId,
        planId: input.planId,
        billingInterval: input.billingInterval,
      },
    });

    if (!session.url) {
      this.logger.error('Stripe checkout session created without a URL');
      throw new Error('Stripe did not return a checkout URL');
    }

    this.logger.log(`Stripe checkout created: ${session.id} for payment ${input.paymentId}`);
    return {
      checkoutUrl: session.url,
      sessionRef: session.id,
      raw: { sessionId: session.id, paymentIntent: session.payment_intent },
    };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<PaymentVerificationResult> {
    const client = this.requireClient();
    const session = await client.checkout.sessions.retrieve(input.sessionRef, {
      expand: ['payment_intent'],
    });

    const paymentIntent =
      typeof session.payment_intent === 'string'
        ? null
        : (session.payment_intent as Stripe.PaymentIntent | null);

    const paid = session.payment_status === 'paid';
    const transactionRef = paymentIntent?.id ?? null;

    return {
      verified: paid,
      status: paid ? 'SUCCEEDED' : session.status === 'expired' ? 'CANCELLED' : 'PENDING',
      transactionRef,
      raw: {
        sessionId: session.id,
        paymentStatus: session.payment_status,
        sessionStatus: session.status,
        paymentIntentId: transactionRef,
      },
    };
  }

  async handleWebhook(input: WebhookInput): Promise<WebhookHandlingResult> {
    const client = this.requireClient();
    if (!this.webhookSecret) {
      throw new ServiceUnavailableException('Stripe webhook is not configured');
    }

    const signature = input.headers['stripe-signature'];
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    let event: Stripe.Event;
    try {
      event = client.webhooks.constructEvent(input.rawBody, signature, this.webhookSecret);
    } catch (error) {
      this.logger.warn(`Stripe webhook signature verification failed: ${(error as Error).message}`);
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    this.logger.log(`Stripe webhook received: ${event.type} (${event.id})`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        // Only a fully-paid session activates the subscription. Sessions that
        // complete without payment (e.g. async methods still pending) must wait
        // for checkout.session.async_payment_succeeded.
        if (session.payment_status !== 'paid') {
          return {
            handled: false,
            eventType: event.type,
            sessionRef: session.id,
            metadata: { eventId: event.id },
            raw: { sessionId: session.id, paymentStatus: session.payment_status },
          };
        }
        const paymentIntent =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id ?? null;
        return {
          handled: true,
          eventType: event.type,
          status: 'SUCCEEDED',
          sessionRef: session.id,
          transactionRef: paymentIntent,
          metadata: { eventId: event.id },
          raw: { sessionId: session.id, paymentIntentId: paymentIntent },
        };
      }
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object as Stripe.Checkout.Session;
        return {
          handled: true,
          eventType: event.type,
          status: 'CANCELLED',
          sessionRef: session.id,
          transactionRef: null,
          metadata: { eventId: event.id },
          raw: { sessionId: session.id },
        };
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        // Ignore partial refunds: only a full refund voids the payment.
        // `amount_refunded === amount` indicates the charge is fully refunded.
        if (charge.amount_refunded < charge.amount) {
          return {
            handled: false,
            eventType: event.type,
            metadata: { eventId: event.id },
            raw: { chargeId: charge.id, amountRefunded: charge.amount_refunded },
          };
        }
        const paymentIntent =
          typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent?.id ?? null;
        return {
          handled: true,
          eventType: event.type,
          status: 'REFUNDED',
          transactionRef: paymentIntent,
          metadata: { eventId: event.id },
          raw: { chargeId: charge.id, paymentIntentId: paymentIntent },
        };
      }
      default:
        return { handled: false, eventType: event.type, raw: { eventId: event.id } };
    }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    const client = this.requireClient();
    const paymentIntentId = input.payment.transactionRef;
    if (!paymentIntentId) {
      throw new Error('Cannot refund a payment without a transaction reference');
    }

    const refund = await client.refunds.create({
      payment_intent: paymentIntentId,
      ...(input.amount !== undefined
        ? { amount: Math.round(input.amount * 100) }
        : {}),
    });

    const succeeded = refund.status === 'succeeded' || refund.status === 'pending';
    this.logger.log(`Stripe refund ${refund.status} for payment intent ${paymentIntentId}`);
    return {
      refunded: succeeded,
      refundRef: refund.id,
      raw: { refundId: refund.id, status: refund.status },
    };
  }

  private requireClient(): Stripe {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Online payment is not available right now. Please try again later or start your free trial.',
      );
    }
    return this.client;
  }
}
