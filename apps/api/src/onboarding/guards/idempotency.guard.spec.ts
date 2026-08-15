import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IdempotencyGuard } from './idempotency.guard';
import { IdempotencyService } from '../services/idempotency.service';

function mockContext(request: Record<string, unknown>, response: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function makeRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { headers: {}, params: { id: 'session-1' }, ...overrides };
}

describe('IdempotencyGuard', () => {
  let reflector: Reflector;
  let idempotencyService: IdempotencyService;
  let findByKey: jest.Mock;
  let guard: IdempotencyGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) } as unknown as Reflector;
    findByKey = jest.fn().mockResolvedValue(null);
    idempotencyService = { findByKey } as unknown as IdempotencyService;
    guard = new IdempotencyGuard(reflector, idempotencyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('namespaces the client key by session id when looking up a cached response', async () => {
    const request = makeRequest({ headers: { 'x-idempotency-key': 'provision' } });
    const response = {};
    const context = mockContext(request, response);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(findByKey).toHaveBeenCalledWith('session-1:provision');
    expect(request.idempotencyKey).toBe('session-1:provision');
  });

  it('returns the cached response only for the same session that produced it', async () => {
    findByKey.mockResolvedValue({ organizationId: 'org-1', email: 'victim@x.com' });
    const request = makeRequest({ headers: { 'x-idempotency-key': 'provision' } });
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const context = mockContext(request, response);

    const result = await guard.canActivate(context);

    expect(result).toBe(false);
    expect(findByKey).toHaveBeenCalledWith('session-1:provision');
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ organizationId: 'org-1', email: 'victim@x.com' });
  });

  it('uses different scoped keys for different sessions with the same header value', async () => {
    const reqA = makeRequest({ headers: { 'x-idempotency-key': 'provision' }, params: { id: 'session-a' } });
    const reqB = makeRequest({ headers: { 'x-idempotency-key': 'provision' }, params: { id: 'session-b' } });

    await guard.canActivate(mockContext(reqA, {}));
    await guard.canActivate(mockContext(reqB, {}));

    expect(findByKey).toHaveBeenCalledWith('session-a:provision');
    expect(findByKey).toHaveBeenCalledWith('session-b:provision');
  });

  it('passes through when no idempotency key is provided', async () => {
    const request = makeRequest({ headers: {} });

    const result = await guard.canActivate(mockContext(request, {}));

    expect(result).toBe(true);
    expect(findByKey).not.toHaveBeenCalled();
  });
});
