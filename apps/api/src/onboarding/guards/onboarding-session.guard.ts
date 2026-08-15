import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { ConfigService } from '../../config/config.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Authorizes access to a single onboarding session.
 *
 * A request is allowed when it presents EITHER:
 *  1. a valid one-time onboarding token (header `X-Onboarding-Token` or query
 *     param `token`) whose payload binds it to the requested session. During
 *     the anonymous phase (no bound user) the token alone suffices; once a
 *     user is bound it must be accompanied by the owner's access JWT.
 *  2. a valid access JWT whose subject is the user the session belongs to.
 *  3. (SSE progress stream only) a short-lived SSE credential (query param
 *     `sseToken`) issued by the owner, bound to the session AND the current
 *     user identity (`uid` claim). The onboarding token is NOT valid for a
 *     bound session's stream.
 *
 * Anything else gets a 401 (no/invalid credentials) or 403 (valid credentials
 * that do not own this session). This prevents session hijacking and makes it
 * impossible to fetch a session by knowing only its id.
 */
@Injectable()
export class OnboardingSessionGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const sessionId = (request.params as Record<string, string>).id;
    if (!sessionId) {
      throw new UnauthorizedException('Onboarding session token required');
    }

    const authHeader = request.headers.authorization;
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const payload = bearer ? this.decodeJwt(bearer) : null;

    // Expose the authenticated caller to handlers even when the session-bound
    // onboarding token is used (e.g. registration), so the service can verify
    // that account-affecting fields belong to the caller.
    if (payload) {
      (request as Request & { user?: { id?: string; role?: string } }).user = {
        id: payload.id,
        role: payload.role,
      };
    }

    const isSseRequest = request.headers.accept === 'text/event-stream';

    // EventSource cannot set headers, so SSE progress streaming authorizes
    // with a short-lived credential issued by the owner via `GET
    // sessions/:id/sse-token` (see OnboardingService.issueSseToken). The
    // credential is bound to the session AND to the current user identity:
    // an anonymous session only accepts `uid=null`, a bound session only
    // accepts `uid === session.userId`. A credential issued before binding
    // (uid=null) therefore stops working once a user is bound, and a
    // credential issued for one owner never works for another.
    const sseToken = isSseRequest
      ? (request.query.sseToken as string | undefined)
      : undefined;

    if (sseToken) {
      const session = await this.prisma.onboardingSession.findUnique({
        where: { id: sessionId },
        select: { userId: true },
      });
      if (!session) {
        throw new UnauthorizedException('Invalid or expired session stream');
      }
      const boundUserId = (session.userId as string | null) ?? null;
      if (!this.isValidSseToken(sseToken, sessionId, boundUserId)) {
        throw new UnauthorizedException('Invalid or expired session stream');
      }
      return true;
    }

    const onboardingToken =
      (request.headers['x-onboarding-token'] as string | undefined) ??
      (request.query.token as string | undefined);

    if (onboardingToken) {
      if (!this.isValidOnboardingToken(onboardingToken, sessionId)) {
        throw new UnauthorizedException('Invalid or expired onboarding session');
      }

      const session = await this.prisma.onboardingSession.findUnique({
        where: { id: sessionId },
        select: { userId: true },
      });
      if (!session) {
        throw new UnauthorizedException('Invalid or expired onboarding session');
      }

      // Anonymous phase (no bound user yet): the token alone is sufficient.
      if (!session.userId) {
        return true;
      }

      if (isSseRequest) {
        throw new ForbiddenException('You do not have access to this onboarding session');
      }
      if (payload && payload.id === session.userId) {
        return true;
      }
      throw new ForbiddenException('You do not have access to this onboarding session');
    }

    if (payload) {
      const session = await this.prisma.onboardingSession.findUnique({
        where: { id: sessionId },
        select: { userId: true },
      });
      if (session?.userId === payload.id) {
        return true;
      }
      throw new ForbiddenException('You do not have access to this onboarding session');
    }

    throw new UnauthorizedException('Onboarding session token required');
  }

  private isValidOnboardingToken(token: string, sessionId: string): boolean {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.jwtSecret,
        issuer: 'bc-onboarding',
        audience: 'bc-onboarding-session',
      }) as { purpose?: string; sub?: string };
      return payload?.purpose === 'onboarding' && payload.sub === sessionId;
    } catch {
      return false;
    }
  }

  private isValidSseToken(token: string, sessionId: string, expectedUserId: string | null): boolean {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.jwtSecret,
        issuer: 'bc-onboarding-sse',
        audience: 'bc-onboarding-sse-stream',
      }) as { purpose?: string; sub?: string; uid?: string | null };
      return (
        payload?.purpose === 'sse' &&
        payload.sub === sessionId &&
        (payload.uid ?? null) === expectedUserId
      );
    } catch {
      return false;
    }
  }

  private decodeJwt(token: string): { id: string; role?: string } | null {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.jwtSecret,
      }) as { id?: string; role?: string };
      return payload?.id ? { id: payload.id, role: payload.role } : null;
    } catch {
      return null;
    }
  }
}
