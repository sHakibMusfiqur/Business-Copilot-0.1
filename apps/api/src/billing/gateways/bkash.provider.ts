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
 * bKash provider scaffold.
 *
 * TODO(bkash): implement the bKash (Bangladesh mobile wallet) gateway
 * integration. See https://developer.bka.sh for the checkout API.
 *
 * Configuration keys (PaymentGateway.config JSON):
 *   - appKey     (or BKASH_APP_KEY)
 *   - appSecret  (or BKASH_APP_SECRET)
 *   - username   (or BKASH_USERNAME)
 *   - password   (or BKASH_PASSWORD)
 *   - sandbox    (boolean, or BKASH_SANDBOX)
 */
export class BkashProvider implements PaymentGateway {
  readonly code = 'bkash';

  private readonly logger = new Logger(BkashProvider.name);

  constructor(
    _config: GatewayConfig,
    _configService?: unknown,
  ) {}

  isConfigured(): boolean {
    return false;
  }

  async createCheckoutSession(_input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    this.logger.warn('bKash createCheckoutSession called but not implemented yet');
    throw new Error('bKash gateway is not implemented yet');
  }

  async verifyPayment(_input: VerifyPaymentInput): Promise<PaymentVerificationResult> {
    this.logger.warn('bKash verifyPayment called but not implemented yet');
    throw new Error('bKash gateway is not implemented yet');
  }

  async handleWebhook(_input: WebhookInput): Promise<WebhookHandlingResult> {
    this.logger.warn('bKash handleWebhook called but not implemented yet');
    throw new Error('bKash gateway is not implemented yet');
  }

  async refundPayment(_input: RefundPaymentInput): Promise<RefundPaymentResult> {
    this.logger.warn('bKash refundPayment called but not implemented yet');
    throw new Error('bKash gateway is not implemented yet');
  }
}
