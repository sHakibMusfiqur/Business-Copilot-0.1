import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IdempotencyService } from '../services/idempotency.service';

const IDEMPOTENCY_HEADER = 'x-idempotency-key';

@Injectable()
export class IdempotencyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const enabled = this.reflector.getAllAndOverride<boolean>('idempotency', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!enabled) return true;

    const request = context.switchToHttp().getRequest();
    const key = request.headers[IDEMPOTENCY_HEADER] as string | undefined;

    if (!key) return true;

    
    const sessionId = (request.params as Record<string, string>).id;
    const scopedKey = sessionId ? `${sessionId}:${key}` : key;

    const cached = await this.idempotencyService.findByKey(scopedKey);
    if (cached) {
      const response = context.switchToHttp().getResponse();
      response.status(200).json(cached);
      return false;
    }

    request.idempotencyKey = scopedKey;
    return true;
  }
}
