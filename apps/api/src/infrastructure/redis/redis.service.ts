import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

import { ConfigService } from '../../config/config.service';

export interface RedisSetOptions {
  /** Optional TTL in seconds. When omitted, the key persists indefinitely. */
  ttlSeconds?: number;
}


@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis | null;

  constructor(private readonly config: ConfigService) {
    const redisUrl = this.readRedisUrl();
    if (!redisUrl) {
      this.client = null;
      this.logger.warn(
        'Redis unavailable: REDIS_URL is not set. Redis-backed features are disabled and will return empty/unavailable states.',
      );
      return;
    }

    this.client = this.createClient(redisUrl);
  }

  /** True when a Redis client is available (REDIS_URL present). */
  isEnabled(): boolean {
    return this.client !== null;
  }

  /** Returns the shared client for infrastructure consumers (e.g. rate limiter). */
  getClient(): Redis | null {
    return this.client;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    const raw = await this.client.get(key);
    if (raw === null || raw === undefined) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, options?: RedisSetOptions): Promise<void> {
    if (!this.client) return;
    const raw = JSON.stringify(value);
    if (options?.ttlSeconds && options.ttlSeconds > 0) {
      await this.client.set(key, raw, 'EX', options.ttlSeconds);
    } else {
      await this.client.set(key, raw);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;
    return (await this.client.exists(key)) === 1;
  }

  /**
   * Scopes a key under an organization so future tenant caching can never
   * cross organization boundaries. No business caching is introduced now.
   */
  organizationKey(organizationId: string, key: string): string {
    return `organization:${organizationId}:${key}`;
  }

  async ping(): Promise<boolean> {
    if (!this.client) return false;
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) return undefined;
    try {
      await this.client.quit();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Redis shutdown error: ${message}`);
    }
  }

  private readRedisUrl(): string {
    try {
      return (this.config.redisUrl ?? '').trim();
    } catch {
      return '';
    }
  }

  private createClient(redisUrl: string): Redis {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      retryStrategy: (times) => Math.min(times * 200, 2000),
      lazyConnect: true,
      enableReadyCheck: true,
    });

    client.on('connect', () => this.logger.log('Redis connected'));
    client.on('ready', () => this.logger.log('Redis ready'));
    client.on('error', (err) => this.logger.warn(`Redis error: ${this.redact(err.message, redisUrl)}`));
    client.on('close', () => this.logger.warn('Redis disconnected'));
    client.on('reconnecting', () => this.logger.log('Redis reconnecting'));
    client.on('end', () => this.logger.log('Redis connection closed'));

    client.connect().catch((err) => {
      this.logger.warn(`Redis initial connection failed: ${this.redact(err.message, redisUrl)}`);
    });

    return client;
  }

  /** Removes the connection URL and any embedded password from an error message. */
  private redact(message: string, redisUrl: string): string {
    if (!message) return message;
    let out = message;
    if (redisUrl) out = out.split(redisUrl).join('[redacted]');
    const password = this.passwordFromUrl(redisUrl);
    if (password) out = out.split(password).join('[redacted]');
    return out;
  }

  private passwordFromUrl(redisUrl: string): string | null {
    if (!redisUrl) return null;
    const match = /:\/\/[^:]+:([^@]+)@/.exec(redisUrl);
    return match ? match[1] : null;
  }
}