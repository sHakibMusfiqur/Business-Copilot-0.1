export type BillingInterval = 'MONTHLY' | 'YEARLY';

export type PaymentStatus =
  | 'PENDING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REFUNDED'
  | 'CANCELLED';

export interface CheckoutSessionInput {
  paymentId: string;
  organizationId: string;
  userId?: string;
  planId: string;
  planName: string;
  amount: number;
  currency: string;
  billingInterval: BillingInterval;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface CheckoutSessionResult {
  checkoutUrl: string;
  sessionRef: string;
  raw?: Record<string, unknown>;
}

export interface VerifyPaymentInput {
  sessionRef: string;
  paymentId: string;
  organizationId: string;
  amount: number;
  currency: string;
}

export interface PaymentVerificationResult {
  verified: boolean;
  status: PaymentStatus;
  transactionRef: string | null;
  metadata?: Record<string, unknown>;
  eventType?: string;
  raw?: Record<string, unknown>;
}

export interface WebhookInput {
  gatewayCode: string;
  rawBody: string;
  headers: Record<string, string>;
}

export interface WebhookHandlingResult {
  handled: boolean;
  eventType: string;
  status?: PaymentStatus;
  sessionRef?: string;
  transactionRef?: string | null;
  metadata?: Record<string, unknown>;
  raw?: Record<string, unknown>;
}

export interface RefundPaymentInput {
  payment: {
    id: string;
    amount: number;
    currency: string;
    transactionRef: string | null;
    gatewayData: Record<string, unknown> | null;
  };
  amount?: number;
  reason?: string;
  /**
   * Stable key binding a refund to exactly one gateway refund operation, so that
   * concurrent or retried refund requests can never double-refund at the gateway.
   */
  idempotencyKey?: string;
}

export interface RefundPaymentResult {
  refunded: boolean;
  refundRef: string | null;
  raw?: Record<string, unknown>;
}

export interface GatewayConfig {
  secretKey?: string;
  publishableKey?: string;
  webhookSecret?: string;
  merchantId?: string;
  storeId?: string;
  apiKey?: string;
  apiSecret?: string;
  email?: string;
  username?: string;
  password?: string;
  baseUrl?: string;
  [key: string]: unknown;
}

export interface PaymentGateway {
  readonly code: string;
  /** Whether the provider has the credentials/config needed to process payments. */
  isConfigured(): boolean;
  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult>;
  verifyPayment(input: VerifyPaymentInput): Promise<PaymentVerificationResult>;
  handleWebhook(input: WebhookInput): Promise<WebhookHandlingResult>;
  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult>;
}
