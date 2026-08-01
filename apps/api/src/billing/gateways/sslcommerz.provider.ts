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
 * SSLCommerz provider scaffold.
 *
 * TODO(sslcommerz): implement the SSLCommerz gateway integration.
 * See https://developer.sslcommerz.com for API reference.
 *
 * Configuration keys (PaymentGateway.config JSON):
 *   - storeId  (or SSLCOMMERZ_STORE_ID)
 *   - storePass (or SSLCOMMERZ_STORE_PASSWORD)
 *   - sandbox  (boolean, or SSLCOMMERZ_SANDBOX)
 */
export class SslcommerzProvider implements PaymentGateway {
  readonly code = 'sslcommerz';

  private readonly logger = new Logger(SslcommerzProvider.name);

  constructor(
    _config: GatewayConfig,
    _configService?: unknown,
  ) {}

  isConfigured(): boolean {
    return false;
  }

  async createCheckoutSession(_input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    this.logger.warn('SSLCommerz createCheckoutSession called but not implemented yet');
    throw new Error('SSLCommerz gateway is not implemented yet');
  }

  async verifyPayment(_input: VerifyPaymentInput): Promise<PaymentVerificationResult> {
    this.logger.warn('SSLCommerz verifyPayment called but not implemented yet');
    throw new Error('SSLCommerz gateway is not implemented yet');
  }

  async handleWebhook(_input: WebhookInput): Promise<WebhookHandlingResult> {
    this.logger.warn('SSLCommerz handleWebhook called but not implemented yet');
    throw new Error('SSLCommerz gateway is not implemented yet');
  }

  async refundPayment(_input: RefundPaymentInput): Promise<RefundPaymentResult> {
    this.logger.warn('SSLCommerz refundPayment called but not implemented yet');
    throw new Error('SSLCommerz gateway is not implemented yet');
  }
}
