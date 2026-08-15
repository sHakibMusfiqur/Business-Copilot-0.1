import { ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { OnboardingService } from './onboarding.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '../config/config.service';
import { IndustryTemplateFactory } from './industry-templates/industry-template.factory';
import type { UpdateSessionDto } from './dto/update-session.dto';

function buildSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    email: 'user@x.com',
    name: 'User',
    userId: null,
    version: 1,
    currentStep: 0,
    completedSteps: [],
    provisionStatus: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('OnboardingService (session ownership binding)', () => {
  let service: OnboardingService;
  let findUnique: jest.Mock;
  let updateMany: jest.Mock;

  function buildService(session: Record<string, unknown>) {
    findUnique = jest.fn().mockResolvedValue(session);
    updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      onboardingSession: { findUnique, updateMany },
    };
    service = new OnboardingService(
      prisma as unknown as PrismaService,
      { record: jest.fn() } as unknown as AuditService,
      {} as unknown as IndustryTemplateFactory,
      {} as unknown as JwtService,
      { jwtSecret: 'secret' } as unknown as ConfigService,
    );
  }

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('binds the session to the caller the first time', async () => {
    buildService(buildSession({ userId: null }));

    await service.updateSession('session-1', { userId: 'user-a' } as UpdateSessionDto, 'user-a');

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'user-a' }) }),
    );
  });

  it('rejects rebinding an already-bound session to a different user', async () => {
    buildService(buildSession({ userId: 'user-a' }));

    await expect(
      service.updateSession('session-1', { userId: 'user-b' } as UpdateSessionDto, 'user-b'),
    ).rejects.toThrow(ForbiddenException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('allows the bound user to send their own userId again (idempotent)', async () => {
    buildService(buildSession({ userId: 'user-a' }));

    await service.updateSession('session-1', { userId: 'user-a' } as UpdateSessionDto, 'user-a');

    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it('rejects binding without an authenticated caller', async () => {
    buildService(buildSession({ userId: null }));

    await expect(
      service.updateSession('session-1', { userId: 'user-a' } as UpdateSessionDto, null),
    ).rejects.toThrow(ForbiddenException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rejects binding to an account that is not the authenticated caller', async () => {
    buildService(buildSession({ userId: null }));

    await expect(
      service.updateSession('session-1', { userId: 'user-b' } as UpdateSessionDto, 'user-a'),
    ).rejects.toThrow(ForbiddenException);
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe('OnboardingService (issueSseToken)', () => {
  const SESSION_ID = 'session-1';

  function buildService(
    session: Record<string, unknown> | null,
    sign = jest.fn(() => 'signed-sse-token'),
  ) {
    const prisma = {
      onboardingSession: {
        findUnique: jest.fn().mockResolvedValue(session),
      },
    };
    const jwtService = { sign } as unknown as JwtService;
    const service = new OnboardingService(
      prisma as unknown as PrismaService,
      { record: jest.fn() } as unknown as AuditService,
      {} as unknown as IndustryTemplateFactory,
      jwtService,
      { jwtSecret: 'secret' } as unknown as ConfigService,
    );
    return { service, sign, prisma };
  }

  it('binds the SSE credential to the bound owner', async () => {
    const { service, sign } = buildService({ id: SESSION_ID, userId: 'user-b' });

    const result = await service.issueSseToken(SESSION_ID, 'user-b');

    expect(sign).toHaveBeenCalledWith(
      { sub: SESSION_ID, purpose: 'sse', uid: 'user-b' },
      expect.objectContaining({
        issuer: 'bc-onboarding-sse',
        audience: 'bc-onboarding-sse-stream',
      }),
    );
    expect(result).toEqual({ token: 'signed-sse-token', expiresInSeconds: 120 });
  });

  it('binds the SSE credential to no user for an anonymous session', async () => {
    const { service, sign } = buildService({ id: SESSION_ID, userId: null });

    await service.issueSseToken(SESSION_ID, null);

    expect(sign).toHaveBeenCalledWith(
      { sub: SESSION_ID, purpose: 'sse', uid: null },
      expect.objectContaining({ issuer: 'bc-onboarding-sse' }),
    );
  });

  it('rejects a caller that is not the bound owner', async () => {
    const { service, sign } = buildService({ id: SESSION_ID, userId: 'user-b' });

    await expect(service.issueSseToken(SESSION_ID, 'user-a')).rejects.toThrow(ForbiddenException);
    expect(sign).not.toHaveBeenCalled();
  });

  it('rejects a registered caller on an anonymous session', async () => {
    const { service, sign } = buildService({ id: SESSION_ID, userId: null });

    await expect(service.issueSseToken(SESSION_ID, 'user-a')).rejects.toThrow(ForbiddenException);
    expect(sign).not.toHaveBeenCalled();
  });

  it('throws NotFound for a session that no longer exists', async () => {
    const { service, sign } = buildService(null);

    await expect(service.issueSseToken(SESSION_ID, null)).rejects.toThrow('Onboarding session not found');
    expect(sign).not.toHaveBeenCalled();
  });
});
