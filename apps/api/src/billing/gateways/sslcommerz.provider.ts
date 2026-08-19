import { Logger, ServiceUnavailableException } from '@nestjs/common';

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

const SANDBOX_BASE = 'https://sandbox-gw.sslcommerz.com';
const LIVE_BASE = 'https://securepay.sslcommerz.com';
const INITIATION_PATH = '/gwprocess/v4/api.php';
const VALIDATION_PATH = '/validator/api/validationserverAPI.php';
const CHARGE_CURRENCY = 'BDT';
const MIN_CHARGE_AMOUNT = 10;

/**
 * SSLCommerz provider for the hosted payment-page flow.
 *
 * - Initiation: POST to `gwprocess/v4/api.php` with the store credentials and a
 *   unique `tran_id`; SSLCommerz returns a `gatewayPageURL` the browser is sent to.
 * - Verification: the SSLCommerz Order Validation API keyed on `val_id` is called
 *   server-side (never trusting the browser) and its `transaction_status`, amount
 *   and currency are cross-checked against the recorded payment.
 * - IPN: handled by the same webhook endpoint; like Stripe, every IPN is re-validated
 *   through the Order Validation API because there is no signed IPN secret.
 * - Currency: charges Bangladeshi Taka. The USD plan price is converted to BDT via a
 *   configured fixed rate (min 10.00 BDT) using {@link resolveAmount}, so the recorded
 *   payment and the validation comparison both use the same BDT amount.
 *
 * Configuration (PaymentGateway.config JSON, falling back to environment):
 *   - storeId          (or SSLCOMMERZ_STORE_ID)
 *   - storePass        (or SSLCOMMERZ_STORE_PASSWORD)
 *   - live/sandbox     (or SSLCOMMERZ_IS_LIVE, default sandbox)
 */
export class SslcommerzProvider implements PaymentGateway {
  readonly code = 'sslcommerz';

  private readonly logger = new Logger(SslcommerzProvider.name);

  private readonly storeId: string;
  private readonly storePassword: string;
  private readonly live: boolean;
  private readonly usdToBdtRate: number;
  private readonly ipnUrl: string;

  constructor(
    config: GatewayConfig,
    configService?: ConfigService,
  ) {
    // Credentials never leave this provider (no logging, no API responses).
    this.storeId = (config.storeId as string | undefined) ?? configService?.sslcommerzStoreId ?? '';
    this.storePassword =
      (config.storePass as string | undefined) ?? configService?.sslcommerzStorePassword ?? '';

    const liveFromConfig = config.live as boolean | undefined;
    const sandboxFromConfig = config.sandbox as boolean | undefined;
    this.live =
      liveFromConfig ??
      (sandboxFromConfig === undefined
        ? (configService?.sslcommerzIsLive ?? false)
        : !sandboxFromConfig);

    this.usdToBdtRate = configService?.sslcommerzUsdToBdtRate ?? 110;
    this.ipnUrl =
      configService?.sslcommerzIpnUrl ??
      `${configService?.apiUrl ?? 'http://localhost:4000'}/api/billing/webhooks/sslcommerz`;
  }

  private get baseUrl(): string {
    return this.live ? LIVE_BASE : SANDBOX_BASE;
  }

  isConfigured(): boolean {
    return Boolean(this.storeId && this.storePassword);
  }

  resolveAmount(input: { amount: number; currency: string }): { amount: number; currency: string } {
    // SSLCommerz only accepts BDT. Convert the backend-resolved USD price to BDT
    // and enforce the gateway's 10.00 BDT minimum. The same resolved value is
    // stored on the payment and used for validation, so the recorded charge always
    // matches what the gateway honors.
    const bdt = Math.round(Number(input.amount) * this.usdToBdtRate);
    return { amount: Math.max(MIN_CHARGE_AMOUNT, bdt), currency: CHARGE_CURRENCY };
  }

  async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    this.requireClient();
    // The orchestrator already resolved the charge (incl. any currency conversion)
    // via `resolveAmount`, so the gateway simply charges the amount it was given.
    const totalAmount = Number(input.amount);

    const form: Record<string, string> = {
      store_id: this.storeId,
      store_passwd: this.storePassword,
      total_amount: totalAmount.toFixed(2),
      currency: CHARGE_CURRENCY,
      // tran_id must be unique per transaction; the payment id is a unique UUID.
      tran_id: input.paymentId,
      success_url: input.successUrl,
      fail_url: input.failUrl ?? input.cancelUrl,
      cancel_url: input.cancelUrl,
      ipn_url: this.ipnUrl,
      // Customer descriptor fields required to initiate a payment page. The checkout
      // interface carries no customer PII; placeholders are used (acceptable for the
      // sandbox integration) and would be sourced from the authenticated profile in
      // production.
      cus_name: 'Business Copilot Customer',
      cus_email: 'customer@business-copilot.local',
      cus_phone: '01700000000',
      cus_add1: 'Dhaka',
      cus_city: 'Dhaka',
      cus_postcode: '1207',
      cus_country: 'Bangladesh',
      product_name: `${input.planName} (${input.billingInterval})`,
      num_of_item: '1',
      product_profile: 'general',
      shipping_method: 'NO',
      product_category: 'Business Software Subscription',
    };

    const response = await this.postForm(`${this.baseUrl}${INITIATION_PATH}`, form);
    if (response.status !== 'success' || !response.gatewayPageURL) {
      const reason = typeof response.failedreason === 'string' ? response.failedreason : 'unknown reason';
      this.logger.error(`SSLCommerz initiation failed for payment ${input.paymentId}: ${reason}`);
      throw new ServiceUnavailableException(
        'Could not start secure checkout. Please try again later or start your free trial.',
      );
    }

    this.logger.log(`SSLCommerz checkout created (tran_id=${input.paymentId})`);
    // Only lightweight, non-secret fields are persisted into gatewayData.
    return {
      checkoutUrl: response.gatewayPageURL as string,
      sessionRef: input.paymentId,
      raw: {
        valId: (response.val_id as string | undefined) ?? null,
        gatewayPageURL: response.gatewayPageURL,
      },
    };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<PaymentVerificationResult> {
    this.requireClient();
    const valId = input.valId;
    if (!valId) {
      // No val_id (e.g. the browser returned an IPN-less state). We cannot authorise
      // server-side without it, so leave the payment PENDING for the IPN to confirm.
      this.logger.log(`SSLCommerz verify skipped for payment ${input.paymentId}: no val_id`);
      return { verified: false, status: 'PENDING', transactionRef: null, raw: { reason: 'no_val_id' } };
    }

    const validated = await this.validateOrder(valId);
    const validatedAmount = Number(validated.amount);
    const validatedCurrency = String(validated.currency ?? '').toUpperCase();

    if (this.isSuccessStatus(validated)) {
      // Reject any amount/currency that does not match the recorded payment rather
      // than activating on the gateway's word alone.
      if (!Number.isFinite(validatedAmount) || validatedAmount !== input.amount) {
        this.logger.warn(
          `SSLCommerz validation amount mismatch for ${valId}: gateway=${validated.amount}, expected=${input.amount}`,
        );
        return {
          verified: false,
          status: 'FAILED',
          transactionRef: null,
          raw: { valId, transactionStatus: validated.transaction_status, amount: validated.amount, currency: validated.currency },
        };
      }
      if (validatedCurrency !== String(input.currency).toUpperCase()) {
        this.logger.warn(
          `SSLCommerz validation currency mismatch for ${valId}: gateway=${validated.currency}, expected=${input.currency}`,
        );
        return {
          verified: false,
          status: 'FAILED',
          transactionRef: null,
          raw: { valId, transactionStatus: validated.transaction_status, amount: validated.amount, currency: validated.currency },
        };
      }
      return {
        verified: true,
        status: 'SUCCEEDED',
        transactionRef: this.bankTransactionRef(validated),
        raw: { valId, transactionStatus: validated.transaction_status, amount: validated.amount, currency: validated.currency },
      };
    }

    if (this.isCancelledStatus(validated)) {
      return { verified: false, status: 'CANCELLED', transactionRef: null, raw: { valId, transactionStatus: validated.transaction_status } };
    }
    if (this.isFailedStatus(validated)) {
      return { verified: false, status: 'FAILED', transactionRef: null, raw: { valId, transactionStatus: validated.transaction_status } };
    }

    // PENDING / PROCESSING / unknown → still in flight; an IPN will settle it.
    return { verified: false, status: 'PENDING', transactionRef: null, raw: { valId, transactionStatus: validated.transaction_status } };
  }

  async handleWebhook(input: WebhookInput): Promise<WebhookHandlingResult> {
    this.requireClient();

    const params = new URLSearchParams(input.rawBody);
    const status = (params.get('status') ?? '').toUpperCase();
    const valId = params.get('val_id') ?? '';
    const tranId = params.get('tran_id') ?? '';
    const ipnAmount = Number(params.get('amount'));
    const ipnCurrency = (params.get('currency') ?? '').toUpperCase();
    // val_id is unique per transaction, so `val_id:status` is a stable event id the
    // orchestrator uses to dedupe repeated IPN deliveries.
    const eventId = `${valId || tranId}:${status}`;

    if (!valId) {
      return { handled: false, eventType: 'ipn.received', sessionRef: tranId || undefined, metadata: { eventId } };
    }

    // An IPN carries no signed secret; authorise it server-side through the Order
    // Validation API with the store credentials before acting on it.
    const validated = await this.validateOrder(valId);
    const validatedAmount = Number(validated.amount);
    const validatedCurrency = String(validated.currency ?? '').toUpperCase();

    if (!Number.isFinite(validatedAmount) || validatedAmount !== ipnAmount || validatedCurrency !== ipnCurrency) {
      return {
        handled: true,
        eventType: 'ipn.mismatch',
        status: 'FAILED',
        sessionRef: tranId || undefined,
        metadata: { eventId },
        raw: { valId, transactionStatus: validated.transaction_status, amount: validated.amount, currency: validated.currency },
      };
    }

   
    const gatewayTranId = String(validated.tran_id ?? '');
    if (tranId && gatewayTranId && gatewayTranId !== tranId) {
      this.logger.warn(
        `SSLCommerz IPN transaction mismatch: val_id belongs to ${gatewayTranId}, claimed ${tranId}`,
      );
      return {
        handled: true,
        eventType: 'ipn.transaction_mismatch',
        status: 'FAILED',
        sessionRef: tranId || undefined,
        metadata: { eventId },
        raw: { valId, transactionStatus: validated.transaction_status, amount: validated.amount, currency: validated.currency, tranId: gatewayTranId },
      };
    }

    if (this.isSuccessStatus(validated)) {
      return {
        handled: true,
        eventType: 'ipn.payment_success',
        status: 'SUCCEEDED',
        sessionRef: tranId || undefined,
        transactionRef: this.bankTransactionRef(validated),
        metadata: { eventId },
        raw: { valId, transactionStatus: validated.transaction_status, amount: validated.amount, currency: validated.currency },
      };
    }
    if (this.isCancelledStatus(validated)) {
      return { handled: true, eventType: 'ipn.payment_cancelled', status: 'CANCELLED', sessionRef: tranId || undefined, metadata: { eventId }, raw: { valId, transactionStatus: validated.transaction_status } };
    }
    if (this.isFailedStatus(validated)) {
      return { handled: true, eventType: 'ipn.payment_failed', status: 'FAILED', sessionRef: tranId || undefined, metadata: { eventId }, raw: { valId, transactionStatus: validated.transaction_status } };
    }

    // PENDING / PROCESSING → do not settle; wait for a later IPN.
    return { handled: false, eventType: 'ipn.payment_pending', status: 'PENDING', sessionRef: tranId || undefined, metadata: { eventId }, raw: { valId, transactionStatus: validated.transaction_status } };
  }

  
  async refundPayment(_input: RefundPaymentInput): Promise<RefundPaymentResult> {
    this.logger.warn('SSLCommerz refund is not yet supported; declining without contacting the gateway');
    return { refunded: false, refundRef: null, raw: { reason: 'refund-not-supported' } };
  }

  private async validateOrder(valId: string): Promise<Record<string, unknown>> {
    this.requireClient();
    const validated = await this.postForm(`${this.baseUrl}${VALIDATION_PATH}`, {
      val_id: valId,
      store_id: this.storeId,
      store_passwd: this.storePassword,
      format: 'json',
    });
    if (validated.status !== 'VALID' && validated.status !== 'VALIDATED' && !validated.transaction_status) {
      this.logger.warn(`SSLCommerz Order Validation for ${valId} returned status=${validated.status}`);
    }
    return validated;
  }

  private async postForm(url: string, body: Record<string, string>): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body).toString(),
      });
    } catch (error) {
      this.logger.error(`SSLCommerz request to ${url} failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException('Could not reach the payment gateway. Please try again later.');
    }
    if (!response.ok) {
      this.logger.error(`SSLCommerz ${url} returned HTTP ${response.status}`);
      throw new Error(`SSLCommerz request failed with status ${response.status}`);
    }
    return (await response.json()) as Record<string, unknown>;
  }

  private isSuccessStatus(validated: Record<string, unknown>): boolean {
    const s = String(validated.transaction_status ?? '').toUpperCase();
    return s === 'VALID' || s === 'VALIDATED';
  }

  private isFailedStatus(validated: Record<string, unknown>): boolean {
    const s = String(validated.transaction_status ?? '').toUpperCase();
    return s === 'FAILED' || s === 'INVALID';
  }

  private isCancelledStatus(validated: Record<string, unknown>): boolean {
    return String(validated.transaction_status ?? '').toUpperCase() === 'CANCELLED';
  }

  private bankTransactionRef(validated: Record<string, unknown>): string | null {
    const ref = (validated.bank_tran_id as string | undefined) ?? (validated.tran_id as string | undefined);
    return ref ?? null;
  }

  private requireClient(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Online payment is not available right now. Please try again later or start your free trial.',
      );
    }
  }
}