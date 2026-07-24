import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuthRateLimiterService } from '../../auth/auth-rate-limiter.service';

@Injectable()
export class AuthThrottleGuard implements CanActivate {
  private readonly logger = new Logger(AuthThrottleGuard.name);

  constructor(private readonly rateLimiter: AuthRateLimiterService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = request.ip ?? '';
    const email = (request.body as Record<string, unknown> | undefined)?.email as string | undefined;
    const userId = (request as unknown as { user?: { id?: string } }).user?.id;

    const keys: string[] = [`ip:${ip}`];
    if (email) keys.push(`email:${email}`);
    if (userId) keys.push(`user:${userId}`);

    for (const key of keys) {
      if (await this.rateLimiter.isBlocked(key)) {
        const remainingMs = await this.rateLimiter.getRemainingBlockedMs(key);
        const retryAfter = Math.ceil(remainingMs / 1000);
        this.logger.warn(
          `Auth throttle BLOCKED ${request.path} key=${key} retryAfter=${retryAfter}s`,
        );
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many attempts. Please try again later.',
            retryAfterSeconds: retryAfter,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    let maxDelay = 0;
    for (const key of keys) {
      const delay = await this.rateLimiter.getDelayMs(key);
      if (delay > maxDelay) maxDelay = delay;
    }

    if (maxDelay > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, maxDelay));
    }

    return true;
  }
}
