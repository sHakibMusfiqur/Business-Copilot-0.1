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
 *     param `token` for SSE) whose payload binds it to the requested session, OR
 *  2. a valid access JWT whose subject is the user the session belongs to.
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

    const onboardingToken =
      (request.headers['x-onboarding-token'] as string | undefined) ??
      (request.query.token as string | undefined);

    if (onboardingToken) {
      if (this.isValidOnboardingToken(onboardingToken, sessionId)) {
        return true;
      }
      throw new UnauthorizedException('Invalid or expired onboarding session');
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
