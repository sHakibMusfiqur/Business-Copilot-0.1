import { Logger } from '@nestjs/common';

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
 * PayPal provider scaffold.
 *
 * TODO(paypal): implement the PayPal gateway integration.
 * See https://developer.paypal.com for the Orders/Rest API reference.
 *
 * Configuration keys (PaymentGateway.config JSON):
 *   - clientId  (or PAYPAL_CLIENT_ID)
 *   - clientSecret (or PAYPAL_CLIENT_SECRET)
 *   - sandbox   (boolean, or PAYPAL_SANDBOX)
 */
export class PaypalProvider implements PaymentGateway {
  readonly code = 'paypal';

  private readonly logger = new Logger(PaypalProvider.name);

  constructor(
    _config: GatewayConfig,
    _configService?: unknown,
  ) {}

  isConfigured(): boolean {
    return false;
  }

  async createCheckoutSession(_input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    this.logger.warn('PayPal createCheckoutSession called but not implemented yet');
    throw new Error('PayPal gateway is not implemented yet');
  }

  async verifyPayment(_input: VerifyPaymentInput): Promise<PaymentVerificationResult> {
    this.logger.warn('PayPal verifyPayment called but not implemented yet');
    throw new Error('PayPal gateway is not implemented yet');
  }

  async handleWebhook(_input: WebhookInput): Promise<WebhookHandlingResult> {
    this.logger.warn('PayPal handleWebhook called but not implemented yet');
    throw new Error('PayPal gateway is not implemented yet');
  }

  async refundPayment(_input: RefundPaymentInput): Promise<RefundPaymentResult> {
    this.logger.warn('PayPal refundPayment called but not implemented yet');
    throw new Error('PayPal gateway is not implemented yet');
  }
}
