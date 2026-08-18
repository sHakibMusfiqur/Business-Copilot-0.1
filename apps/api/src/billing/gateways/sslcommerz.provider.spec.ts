import { ServiceUnavailableException } from '@nestjs/common';

import type { CheckoutSessionInput, GatewayConfig } from './payment-gateway.interface';
import { SslcommerzProvider } from './sslcommerz.provider';

const configService = {
  sslcommerzStoreId: 'demo-store',
  sslcommerzStorePassword: 'secret-store-password',
  sslcommerzIsLive: false,
  sslcommerzUsdToBdtRate: 110,
  sslcommerzIpnUrl: 'http://localhost:4000/api/billing/webhooks/sslcommerz',
  apiUrl: 'http://localhost:4000',
};

function makeProvider(config: GatewayConfig = {}) {
  return new SslcommerzProvider(config, configService as never);
}

/** Mock global fetch and capture every request. Routes by URL to the handler. */
function mockFetch(handler: (url: string, body: string) => Record<string, unknown>) {
  const calls: { url: string; body: string }[] = [];
  (global as unknown as { fetch: unknown }).fetch = jest.fn(
    async (url: string, init?: { body?: string }) => {
      const body = init?.body ?? '';
      calls.push({ url: String(url), body });
      const json = handler(String(url), body);
      return { ok: true, status: 200, json: async () => json } as Response;
    },
  );
  return calls;
}

const checkoutInput: CheckoutSessionInput = {
  paymentId: 'pay-123',
  organizationId: 'org-1',
  userId: 'user-1',
  planId: 'plan-1',
  planName: 'Professional',
  amount: 16390,
  currency: 'BDT',
  billingInterval: 'MONTHLY',
  successUrl: 'http://localhost:3000/onboarding/payment?session_status=success&payment_id=pay-123',
  cancelUrl: 'http://localhost:3000/onboarding/payment?session_status=cancelled&payment_id=pay-123',
  failUrl: 'http://localhost:3000/onboarding/payment?session_status=cancelled&payment_id=pay-123',
  metadata: { paymentId: 'pay-123' },
};

describe('SslcommerzProvider', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('isConfigured', () => {
    it('is configured when credentials come from the config service', () => {
      expect(makeProvider().isConfigured()).toBe(true);
    });

    it('is configured when credentials come from the gateway config JSON', () => {
      const provider = makeProvider({ storeId: 'x', storePass: 'y' });
      expect(provider.isConfigured()).toBe(true);
    });

    it('is not configured when either credential is missing', () => {
      const emptyEnv = {
        ...configService,
        sslcommerzStoreId: '',
        sslcommerzStorePassword: '',
      } as never;
      expect(new SslcommerzProvider({ storeId: 'x' }, emptyEnv).isConfigured()).toBe(false);
      expect(new SslcommerzProvider({ storePass: 'y' }, emptyEnv).isConfigured()).toBe(false);
      expect(new SslcommerzProvider({}, emptyEnv).isConfigured()).toBe(false);
    });
  });

  describe('resolveAmount', () => {
    it('converts the USD plan price to BDT using the configured rate', () => {
      const provider = makeProvider();
      expect(provider.resolveAmount({ amount: 149, currency: 'USD' })).toEqual({
        amount: 16390,
        currency: 'BDT',
      });
    });

    it('enforces the 10.00 BDT minimum charge', () => {
      const provider = makeProvider();
      expect(provider.resolveAmount({ amount: 0, currency: 'USD' }).amount).toBe(10);
      expect(provider.resolveAmount({ amount: 0.01, currency: 'USD' }).amount).toBe(10);
    });

    it('uses a custom rate when configured', () => {
      const provider = new SslcommerzProvider({}, {
        ...configService,
        sslcommerzUsdToBdtRate: 120,
      } as never);
      expect(provider.resolveAmount({ amount: 10, currency: 'USD' }).amount).toBe(1200);
    });
  });

  describe('createCheckoutSession', () => {
    it('posts the initiation form and returns the gateway page URL', async () => {
      const calls = mockFetch((url) => {
        if (url.includes('/gwprocess/v4/api.php')) {
          return { status: 'success', gatewayPageURL: 'https://sandbox-gw.sslcommerz.com/pay?SessionId=abc', val_id: 'val-123' };
        }
        return {};
      });
      const provider = makeProvider();

      const result = await provider.createCheckoutSession(checkoutInput);

      expect(result.sessionRef).toBe('pay-123');
      expect(result.checkoutUrl).toBe('https://sandbox-gw.sslcommerz.com/pay?SessionId=abc');
      expect(result.raw).toEqual({
        valId: 'val-123',
        gatewayPageURL: 'https://sandbox-gw.sslcommerz.com/pay?SessionId=abc',
      });
      // Never persist store credentials into the stored gateway data.
      expect(JSON.stringify(result.raw)).not.toContain('secret-store-password');
      expect(JSON.stringify(result.raw)).not.toContain('demo-store');

      const body = new URLSearchParams(calls[0].body);
      expect(calls[0].url).toContain('https://sandbox-gw.sslcommerz.com');
      expect(calls[0].url).toContain('/gwprocess/v4/api.php');
      expect(body.get('store_id')).toBe('demo-store');
      expect(body.get('store_passwd')).toBe('secret-store-password');
      expect(body.get('tran_id')).toBe('pay-123');
      expect(body.get('total_amount')).toBe('16390.00');
      expect(body.get('currency')).toBe('BDT');
      expect(body.get('success_url')).toContain('session_status=success');
      expect(body.get('fail_url')).toContain('session_status=cancelled');
      expect(body.get('cancel_url')).toContain('session_status=cancelled');
      expect(body.get('ipn_url')).toBe('http://localhost:4000/api/billing/webhooks/sslcommerz');
    });

    it('uses sandbox endpoints, not production, when not live', async () => {
      const calls = mockFetch(() => ({ status: 'success', gatewayPageURL: 'u' }));
      await makeProvider().createCheckoutSession(checkoutInput);
      expect(calls[0].url).not.toContain('securepay.sslcommerz.com');
      expect(calls[0].url).toContain('sandbox-gw.sslcommerz.com');
    });

    it('throws ServiceUnavailableException when initiation fails', async () => {
      mockFetch(() => ({ status: 'fail', failedreason: 'Store id missing' }));
      await expect(makeProvider().createCheckoutSession(checkoutInput)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('verifyPayment', () => {
    const validate = (overrides: Record<string, unknown>) => ({
      status: 'VALID',
      transaction_status: 'VALID',
      amount: '16390.00',
      currency: 'BDT',
      tran_id: 'pay-123',
      bank_tran_id: 'bank-ref-9',
      ...overrides,
    });

    it('reports PENDING when no val_id is available', async () => {
      mockFetch(() => ({}));
      const result = await makeProvider().verifyPayment({
        sessionRef: 'pay-123',
        paymentId: 'pay-123',
        organizationId: 'org-1',
        amount: 16390,
        currency: 'BDT',
      });
      expect(result.status).toBe('PENDING');
      expect(result.verified).toBe(false);
    });

    it('marks SUCCEEDED when validation is VALID and amount/currency match', async () => {
      mockFetch(() => validate({}));
      const result = await makeProvider().verifyPayment({
        sessionRef: 'pay-123',
        paymentId: 'pay-123',
        organizationId: 'org-1',
        amount: 16390,
        currency: 'BDT',
        valId: 'val-123',
      });
      expect(result.status).toBe('SUCCEEDED');
      expect(result.verified).toBe(true);
      expect(result.transactionRef).toBe('bank-ref-9');
    });

    it('rejects a VALID transaction whose amount differs from the recorded payment', async () => {
      mockFetch(() => validate({ amount: '100.00' }));
      const result = await makeProvider().verifyPayment({
        sessionRef: 'pay-123',
        paymentId: 'pay-123',
        organizationId: 'org-1',
        amount: 16390,
        currency: 'BDT',
        valId: 'val-123',
      });
      expect(result.status).toBe('FAILED');
      expect(result.verified).toBe(false);
    });

    it('rejects a VALID transaction whose currency is not BDT', async () => {
      mockFetch(() => validate({ currency: 'USD' }));
      const result = await makeProvider().verifyPayment({
        sessionRef: 'pay-123',
        paymentId: 'pay-123',
        organizationId: 'org-1',
        amount: 16390,
        currency: 'BDT',
        valId: 'val-123',
      });
      expect(result.status).toBe('FAILED');
      expect(result.verified).toBe(false);
    });

    it.each(['INVALID', 'FAILED'])('marks %s as FAILED', async (status) => {
      mockFetch(() => validate({ transaction_status: status, status }));
      const result = await makeProvider().verifyPayment({
        sessionRef: 'pay-123',
        paymentId: 'pay-123',
        organizationId: 'org-1',
        amount: 16390,
        currency: 'BDT',
        valId: 'val-123',
      });
      expect(result.status).toBe('FAILED');
    });

    it('marks CANCELLED when the transaction is cancelled', async () => {
      mockFetch(() => validate({ transaction_status: 'CANCELLED', status: 'CANCELLED' }));
      const result = await makeProvider().verifyPayment({
        sessionRef: 'pay-123',
        paymentId: 'pay-123',
        organizationId: 'org-1',
        amount: 16390,
        currency: 'BDT',
        valId: 'val-123',
      });
      expect(result.status).toBe('CANCELLED');
    });

    it('leaves PENDING until the transaction settles', async () => {
      mockFetch(() => validate({ transaction_status: 'PENDING', status: 'PENDING' }));
      const result = await makeProvider().verifyPayment({
        sessionRef: 'pay-123',
        paymentId: 'pay-123',
        organizationId: 'org-1',
        amount: 16390,
        currency: 'BDT',
        valId: 'val-123',
      });
      expect(result.status).toBe('PENDING');
    });
  });

  describe('handleWebhook (IPN)', () => {
    const ipn = (overrides: Record<string, string> = {}) =>
      new URLSearchParams({
        status: 'VALID',
        tran_id: 'pay-123',
        val_id: 'val-123',
        amount: '16390.00',
        currency: 'BDT',
        bank_tran_id: 'bank-ref-9',
        ...overrides,
      }).toString();

    it('settles a VALID IPN whose validation matches', async () => {
      const calls = mockFetch((url) => {
        if (url.includes('/validator/api/validationserverAPI.php')) {
          return { status: 'VALID', transaction_status: 'VALID', amount: '16390.00', currency: 'BDT', bank_tran_id: 'bank-ref-9', tran_id: 'pay-123' };
        }
        return {};
      });
      const provider = makeProvider();
      const result = await provider.handleWebhook({ gatewayCode: 'sslcommerz', rawBody: ipn(), headers: {} });

      expect(result.handled).toBe(true);
      expect(result.status).toBe('SUCCEEDED');
      expect(result.transactionRef).toBe('bank-ref-9');
      expect(result.sessionRef).toBe('pay-123');
      expect(result.metadata?.eventId).toBe('val-123:VALID');
      // Validation API was called with the store credentials to authorise the IPN.
      const body = new URLSearchParams(calls[0].body);
      expect(body.get('val_id')).toBe('val-123');
      expect(body.get('store_passwd')).toBe('secret-store-password');
    });

    it('marks an IPN FAILED when validation amount differs', async () => {
      mockFetch(() => ({ status: 'VALID', transaction_status: 'VALID', amount: '100.00', currency: 'BDT' }));
      const result = await makeProvider().handleWebhook({ gatewayCode: 'sslcommerz', rawBody: ipn(), headers: {} });
      expect(result.handled).toBe(true);
      expect(result.status).toBe('FAILED');
    });

    it('ignores an IPN missing val_id', async () => {
      mockFetch(() => ({}));
      const result = await makeProvider().handleWebhook({
        gatewayCode: 'sslcommerz',
        rawBody: ipn({ val_id: '' }),
        headers: {},
      });
      expect(result.handled).toBe(false);
    });

    it('does not settle a PENDING IPN', async () => {
      mockFetch(() => ({ status: 'PENDING', transaction_status: 'PENDING', amount: '16390.00', currency: 'BDT' }));
      const result = await makeProvider().handleWebhook({
        gatewayCode: 'sslcommerz',
        rawBody: ipn({ status: 'PENDING' }),
        headers: {},
      });
      expect(result.handled).toBe(false);
      expect(result.status).toBe('PENDING');
    });
  });

  describe('refundPayment', () => {
    it('declines refunds without contacting the gateway', async () => {
      mockFetch(() => ({}));
      const result = await makeProvider().refundPayment({
        payment: { id: 'pay-123', amount: 16390, currency: 'BDT', transactionRef: 'pay-123', gatewayData: null },
      });
      expect(result.refunded).toBe(false);
      expect(result.refundRef).toBeNull();
    });
  });
});