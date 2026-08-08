import { ArgumentsHost, HttpStatus, Logger, NotFoundException } from '@nestjs/common';

import { AllExceptionsFilter } from './http-exception.filter';

interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  setHeader: jest.Mock;
  status: jest.Mock;
  json: jest.Mock;
}

function makeResponse(): MockResponse {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader: jest.fn((k: string, v: string) => {
      res.headers[k] = v;
      return res;
    }),
    status: jest.fn((code: number) => {
      res.statusCode = code;
      return res;
    }),
    json: jest.fn((body: unknown) => {
      res.body = body;
      return res;
    }),
  } as unknown as MockResponse;
  return res;
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter({
    redisUrl: '',
    jwtSecret: 'jwt-secret-value',
    jwtRefreshSecret: 'refresh-secret-value',
    stripeSecretKey: '',
    stripeWebhookSecret: '',
  } as never);
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('returns a safe 500 response for unknown errors, without stack to clients', () => {
    process.env.NODE_ENV = 'production';
    const res = makeResponse();
    const req = {
      method: 'GET',
      url: '/api/secret?token=abc',
      headers: {},
      requestId: 'req-1',
    };

    filter.catch(new Error('DATABASE_URL=postgres://u:p@host && password is suspect'), {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as unknown as ArgumentsHost);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect((res.json as jest.Mock).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        statusCode: 500,
        error: 'Error',
        message: 'Internal server error',
      }),
    );
    const body = res.body as { requestId?: string; stack?: string };
    expect(body.requestId).toBe('req-1');
    expect(body.stack).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('suspect');
    expect(JSON.stringify(body)).not.toContain('DATABASE_URL');
  });

  it('echoes the x-request-id response header for correlation', () => {
    process.env.NODE_ENV = 'production';
    const res = makeResponse();
    const req = { method: 'GET', url: '/boom', headers: {}, requestId: 'req-9' };

    filter.catch(new Error('kaboom'), {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as unknown as ArgumentsHost);

    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'req-9');
  });

  it('does not leak a query-string token from a Nest 404 message into logs or client', () => {
    process.env.NODE_ENV = 'development';
    const res = makeResponse();
    const url = '/api/does-not-exist?token=secretquery123';
    const req = { method: 'GET', url, originalUrl: url, headers: {}, requestId: 'req-404' };
    const loggerSpy = jest.spyOn(Logger.prototype, 'error');

    filter.catch(new NotFoundException('Cannot GET /api/does-not-exist?token=secretquery123'), {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as unknown as ArgumentsHost);

    const logged = loggerSpy.mock.calls.map((c) => String(c[0])).join('\n');
    loggerSpy.mockRestore();

    expect(logged).not.toContain('secretquery123');
    expect(JSON.stringify(res.body)).not.toContain('secretquery123');
  });
});