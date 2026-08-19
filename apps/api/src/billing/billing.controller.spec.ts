import type { Request } from 'express';

import { BillingController } from './billing.controller';
import { PaymentProcessingService } from './payment-processing.service';
import { BillingService } from './billing.service';

function mockReq(overrides: Partial<Record<string, unknown>> = {}): Request {
  return {
    headers: {},
    body: {},
    ...overrides,
  } as Request;
}

describe('BillingController.webhook raw body handling', () => {
  let controller: BillingController;
  let paymentService: { handleWebhook: jest.Mock };
  let billingService: { requireOrg: jest.Mock };

  const ipn =
    'status=VALID&val_id=test-val-id&tran_id=payment-id&amount=8690.00&currency=BDT';

  beforeEach(() => {
    paymentService = { handleWebhook: jest.fn() };
    billingService = { requireOrg: jest.fn() };
    controller = new BillingController(
      billingService as unknown as BillingService,
      paymentService as unknown as PaymentProcessingService,
    );
  });

  it('passes the actual raw form-urlencoded body (Buffer) to the provider', async () => {
    const req = mockReq({
      rawBody: Buffer.from(ipn, 'utf8'),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });

    await controller.handleWebhook('sslcommerz', req);

    expect(paymentService.handleWebhook).toHaveBeenCalledTimes(1);
    const [gateway, rawBody] = (paymentService.handleWebhook as jest.Mock).mock.calls[0];
    expect(gateway).toBe('sslcommerz');
    expect(rawBody).toBe(ipn);
  });

  it('passes a rawBody string through unchanged when it is already a string', async () => {
    const req = mockReq({
      rawBody: '{"event":"x"}',
      headers: { 'content-type': 'application/json' },
    });

    await controller.handleWebhook('card', req);

    const [gateway, rawBody] = (paymentService.handleWebhook as jest.Mock).mock.calls[0];
    expect(gateway).toBe('card');
    expect(rawBody).toBe('{"event":"x"}');
  });

  it('reconstructs a URL-encoded query string when rawBody is missing for a form request', async () => {
    const req = mockReq({
      rawBody: undefined,
      body: {
        status: 'VALID',
        val_id: 'test-val-id',
        tran_id: 'payment-id',
        amount: '8690.00',
        currency: 'BDT',
      },
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });

    await controller.handleWebhook('sslcommerz', req);

    const [, rawBody] = (paymentService.handleWebhook as jest.Mock).mock.calls[0];
    const parsed = new URLSearchParams(rawBody as string);
    expect(parsed.get('status')).toBe('VALID');
    expect(parsed.get('val_id')).toBe('test-val-id');
    expect(parsed.get('tran_id')).toBe('payment-id');
    expect(parsed.get('amount')).toBe('8690.00');
    expect(parsed.get('currency')).toBe('BDT');
  });

  it('keeps JSON-stringifying a parsed JSON body when rawBody is missing (JSON unaffected)', async () => {
    const req = mockReq({
      rawBody: undefined,
      body: { hello: 'world' },
      headers: { 'content-type': 'application/json' },
    });

    await controller.handleWebhook('stripe', req);

    const [, rawBody] = (paymentService.handleWebhook as jest.Mock).mock.calls[0];
    expect(rawBody).toBe('{"hello":"world"}');
  });
});