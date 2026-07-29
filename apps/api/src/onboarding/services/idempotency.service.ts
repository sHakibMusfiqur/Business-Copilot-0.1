import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const SENSITIVE_KEYS = [
  'password', 'secret', 'token', 'apiKey', 'api_key', 'apikey',
  'accessToken', 'refreshToken', 'authorization', 'credentials',
  'privateKey', 'sshKey',
];

export interface IdempotencyOptions {
  ttlMs: number;
  maxPayloadBytes: number;
  filterSensitiveFields: boolean;
}

const DEFAULT_OPTIONS: IdempotencyOptions = {
  ttlMs: 24 * 60 * 60 * 1000,
  maxPayloadBytes: 10240,
  filterSensitiveFields: true,
};

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private options: IdempotencyOptions;

  constructor(
    private readonly prisma: PrismaService,
  ) {
    this.options = { ...DEFAULT_OPTIONS };
  }

  configure(custom: Partial<IdempotencyOptions>): void {
    Object.assign(this.options, custom);
  }

  async findByKey(key: string) {
    const record = await this.prisma.idempotencyRecord.findUnique({ where: { key } });
    if (!record) return null;
    if (record.expiresAt <= new Date()) {
      await this.prisma.idempotencyRecord.delete({ where: { key } });
      return null;
    }
    return record.response;
  }

  async cacheResponse(key: string, response: unknown): Promise<void> {
    const sanitized = this.sanitizeResponse(response) as Record<string, unknown>;
    const serialized = JSON.stringify(sanitized);

    if (serialized.length > this.options.maxPayloadBytes) {
      this.logger.warn(`Response for key ${key} exceeds ${this.options.maxPayloadBytes} bytes, truncating`);
      sanitized._truncated = true;
    }

    await this.prisma.idempotencyRecord.upsert({
      where: { key },
      update: { response: sanitized as never, expiresAt: new Date(Date.now() + this.options.ttlMs) },
      create: {
        key,
        response: sanitized as never,
        expiresAt: new Date(Date.now() + this.options.ttlMs),
      },
    });
  }

  async cleanupExpired(): Promise<number> {
    const result = await this.prisma.idempotencyRecord.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    return result.count;
  }

  private sanitizeResponse(response: unknown): unknown {
    if (response === null || response === undefined) return response;
    if (typeof response !== 'object') return response;
    if (Array.isArray(response)) {
      return response.map((item) => this.sanitizeResponse(item));
    }

    const input = response as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
      if (this.options.filterSensitiveFields && SENSITIVE_KEYS.includes(key)) {
        sanitized[key] = '[FILTERED]';
        continue;
      }

      if (value && typeof value === 'object') {
        sanitized[key] = this.sanitizeResponse(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}
