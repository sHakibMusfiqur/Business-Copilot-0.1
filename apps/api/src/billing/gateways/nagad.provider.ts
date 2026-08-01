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
 * Nagad provider scaffold.
 *
 * TODO(nagad): implement the Nagad (Bangladesh mobile wallet) gateway
 * integration. See https://developer.nagad.com for the checkout API.
 *
 * Configuration keys (PaymentGateway.config JSON):
 *   - merchantId  (or NAGAD_MERCHANT_ID)
 *   - merchantNo  (or NAGAD_MERCHANT_NO)
 *   - publicKey   (or NAGAD_PUBLIC_KEY)
 *   - privateKey  (or NAGAD_PRIVATE_KEY)
 *   - sandbox     (boolean, or NAGAD_SANDBOX)
 */
export class NagadProvider implements PaymentGateway {
  readonly code = 'nagad';

  private readonly logger = new Logger(NagadProvider.name);

  constructor(
    _config: GatewayConfig,
    _configService?: unknown,
  ) {}

  isConfigured(): boolean {
    return false;
  }

  async createCheckoutSession(_input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    this.logger.warn('Nagad createCheckoutSession called but not implemented yet');
    throw new Error('Nagad gateway is not implemented yet');
  }

  async verifyPayment(_input: VerifyPaymentInput): Promise<PaymentVerificationResult> {
    this.logger.warn('Nagad verifyPayment called but not implemented yet');
    throw new Error('Nagad gateway is not implemented yet');
  }

  async handleWebhook(_input: WebhookInput): Promise<WebhookHandlingResult> {
    this.logger.warn('Nagad handleWebhook called but not implemented yet');
    throw new Error('Nagad gateway is not implemented yet');
  }

  async refundPayment(_input: RefundPaymentInput): Promise<RefundPaymentResult> {
    this.logger.warn('Nagad refundPayment called but not implemented yet');
    throw new Error('Nagad gateway is not implemented yet');
  }
}
