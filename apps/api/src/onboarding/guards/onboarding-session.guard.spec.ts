import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnboardingSessionGuard } from './onboarding-session.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '../../config/config.service';

const SESSION_ID = 'session-1';

function buildRequest(overrides: Record<string, unknown> = {}) {
  const request: Record<string, unknown> = {
    method: 'POST',
    headers: {},
    query: {},
    params: { id: SESSION_ID },
    ...overrides,
  };
  return request;
}

function mockContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function buildGuard(
  sessionUserId: string | null,
  jwtVerify: jest.Mock,
  sessionExists = true,
) {
  const prisma = {
    onboardingSession: {
      findUnique: jest.fn().mockResolvedValue(
        sessionExists ? { id: SESSION_ID, userId: sessionUserId } : null,
      ),
    },
  };
  const jwtService = { verify: jwtVerify } as unknown as JwtService;
  const configService = { jwtSecret: 'secret' } as unknown as ConfigService;
  return {
    guard: new OnboardingSessionGuard(prisma as unknown as PrismaService, jwtService, configService),
    prisma,
  };
}

describe('OnboardingSessionGuard', () => {
  const validTokenVerify = jest.fn((_token: string, options: Record<string, unknown>) => {
    if (options?.issuer === 'bc-onboarding') {
      return { purpose: 'onboarding', sub: SESSION_ID };
    }
    return { id: 'user-a', role: 'USER' };
  });

  function sseVerify(uid: string | null) {
    return jest.fn((_token: string, options: Record<string, unknown>) => {
      if (options?.issuer === 'bc-onboarding-sse') {
        return { purpose: 'sse', sub: SESSION_ID, uid };
      }
      if (options?.issuer === 'bc-onboarding') {
        return { purpose: 'onboarding', sub: SESSION_ID };
      }
      return { id: 'user-a', role: 'USER' };
    });
  }

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('allows the onboarding token during the anonymous phase (no bound user)', async () => {
    const { guard, prisma } = buildGuard(null, validTokenVerify);
    const request = buildRequest({ headers: { 'x-onboarding-token': 'tok' } });

    await expect(guard.canActivate(mockContext(request))).resolves.toBe(true);
    expect(prisma.onboardingSession.findUnique).toHaveBeenCalledWith({
      where: { id: SESSION_ID },
      select: { userId: true },
    });
  });

  it('denies a token-only mutation once the session is bound to a user', async () => {
    const { guard } = buildGuard('user-b', validTokenVerify);
    const request = buildRequest({ headers: { 'x-onboarding-token': 'tok' } });

    await expect(guard.canActivate(mockContext(request))).rejects.toThrow(ForbiddenException);
  });

  it('denies a token-only mutation with an unrelated JWT once the session is bound', async () => {
    const { guard } = buildGuard('user-b', validTokenVerify);
    const request = buildRequest({
      headers: { 'x-onboarding-token': 'tok', authorization: 'Bearer user-a-token' },
    });

    await expect(guard.canActivate(mockContext(request))).rejects.toThrow(ForbiddenException);
  });

  it('allows a bound session mutation when the JWT matches the session owner', async () => {
    const { guard } = buildGuard('user-a', validTokenVerify);
    const request = buildRequest({
      headers: { 'x-onboarding-token': 'tok', authorization: 'Bearer user-a-token' },
    });

    await expect(guard.canActivate(mockContext(request))).resolves.toBe(true);
  });

  it('rejects a stale onboarding token on the bound session SSE stream', async () => {
    const { guard } = buildGuard('user-b', validTokenVerify);
    const request = buildRequest({
      query: { token: 'tok' },
      headers: { accept: 'text/event-stream' },
    });

    await expect(guard.canActivate(mockContext(request))).rejects.toThrow(ForbiddenException);
  });

  it('allows the bound session SSE stream with a valid owner SSE credential', async () => {
    const { guard } = buildGuard('user-b', sseVerify('user-b'));
    const request = buildRequest({
      query: { sseToken: 'sse-tok' },
      headers: { accept: 'text/event-stream' },
    });

    await expect(guard.canActivate(mockContext(request))).resolves.toBe(true);
  });

  it('rejects an anonymous SSE credential once the session becomes bound', async () => {
    const { guard } = buildGuard('user-b', sseVerify(null));
    const request = buildRequest({
      query: { sseToken: 'sse-tok' },
      headers: { accept: 'text/event-stream' },
    });

    await expect(guard.canActivate(mockContext(request))).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a different user\u2019s SSE credential on the bound session stream', async () => {
    const { guard } = buildGuard('user-b', sseVerify('user-a'));
    const request = buildRequest({
      query: { sseToken: 'sse-tok' },
      headers: { accept: 'text/event-stream' },
    });

    await expect(guard.canActivate(mockContext(request))).rejects.toThrow(UnauthorizedException);
  });

  it('allows the anonymous session SSE stream with an anonymous SSE credential', async () => {
    const { guard } = buildGuard(null, sseVerify(null));
    const request = buildRequest({
      query: { sseToken: 'sse-tok' },
      headers: { accept: 'text/event-stream' },
    });

    await expect(guard.canActivate(mockContext(request))).resolves.toBe(true);
  });

  it('allows the anonymous session SSE stream via the onboarding token', async () => {
    const { guard } = buildGuard(null, validTokenVerify);
    const request = buildRequest({
      query: { token: 'tok' },
      headers: { accept: 'text/event-stream' },
    });

    await expect(guard.canActivate(mockContext(request))).resolves.toBe(true);
  });

  it('rejects an invalid SSE credential on the session stream', async () => {
    const invalidVerify = jest.fn(() => {
      throw new Error('invalid');
    });
    const { guard } = buildGuard('user-b', invalidVerify);
    const request = buildRequest({
      query: { sseToken: 'bogus' },
      headers: { accept: 'text/event-stream' },
    });

    await expect(guard.canActivate(mockContext(request))).rejects.toThrow(UnauthorizedException);
  });

  it('ignores the SSE credential on non-SSE requests', async () => {
    const { guard } = buildGuard('user-b', validTokenVerify);
    const request = buildRequest({
      query: { sseToken: 'sse-tok' },
      headers: {},
    });

    await expect(guard.canActivate(mockContext(request))).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token for a session that no longer exists', async () => {
    const { guard } = buildGuard(null, validTokenVerify, false);
    const request = buildRequest({ headers: { 'x-onboarding-token': 'tok' } });

    await expect(guard.canActivate(mockContext(request))).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an invalid onboarding token', async () => {
    const invalidVerify = jest.fn(() => {
      throw new Error('invalid');
    });
    const { guard } = buildGuard(null, invalidVerify);
    const request = buildRequest({ headers: { 'x-onboarding-token': 'bad' } });

    await expect(guard.canActivate(mockContext(request))).rejects.toThrow(UnauthorizedException);
  });

  it('allows the bound owner via JWT without a token', async () => {
    const { guard } = buildGuard('user-a', validTokenVerify);
    const request = buildRequest({ headers: { authorization: 'Bearer user-a-token' } });

    await expect(guard.canActivate(mockContext(request))).resolves.toBe(true);
  });

  it('denies a JWT that does not own the session', async () => {
    const { guard } = buildGuard('user-b', validTokenVerify);
    const request = buildRequest({ headers: { authorization: 'Bearer user-a-token' } });

    await expect(guard.canActivate(mockContext(request))).rejects.toThrow(ForbiddenException);
  });

  it('denies requests with no credentials', async () => {
    const { guard } = buildGuard('user-b', validTokenVerify);
    const request = buildRequest();

    await expect(guard.canActivate(mockContext(request))).rejects.toThrow(UnauthorizedException);
  });
});
