import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';

export type RedisConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

export interface RedisHealthMetrics {
  status: RedisConnectionStatus;
  latency: number | null;
  lastPing: number | null;
  lastFailure: number | null;
  reconnectCount: number;
}

/**
 * Observes health of the single shared Redis client.
 *
 * Consumes an existing {@link Redis} instance (owned by RedisService) rather than
 * creating its own connection, guaranteeing only one client per process. Emits
 * onRedisUp/onRedisDown callbacks used by {@link FailsafeRateLimiterStorage}.
 */
@Injectable()
export class RedisHealthService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisHealthService.name);
  private readonly STABILIZATION_THRESHOLD = 5;
  private _status: RedisConnectionStatus = 'disconnected';
  private _lastPing: number | null = null;
  private _lastFailure: number | null = null;
  private _reconnectCount = 0;
  private _latency: number | null = null;
  private _wasDown = false;
  private _consecutiveSuccesses = 0;
  private _onRedisUp: (() => void) | null = null;
  private _onRedisDown: (() => void) | null = null;
  private readonly checkInterval: ReturnType<typeof setInterval>;
  private readonly PING_INTERVAL_MS = 10_000;

  constructor(private readonly redis: Redis) {
    this.redis.on('connect', () => {
      this.logger.log('Redis Connected');
    });

    // Redis is ready before the first scheduled health ping runs. Reflect that
    // truthfully instead of reporting "disconnected" for the first interval.
    this.redis.on('ready', () => {
      if (!this._wasDown) {
        this._status = 'connected';
      }
      this.logger.log('Redis Ready');
    });

    this.redis.on('close', () => {
      this._status = 'disconnected';
      this._consecutiveSuccesses = 0;
      if (!this._wasDown) {
        this._wasDown = true;
        this.logger.warn('Redis Disconnected');
        this._onRedisDown?.();
      }
    });

    this.redis.on('reconnecting', () => {
      this._status = 'reconnecting';
      this.logger.log('Redis Reconnecting');
    });

    this.checkInterval = setInterval(() => this.ping(), this.PING_INTERVAL_MS).unref();
  }

  get status(): RedisConnectionStatus {
    return this._status;
  }

  get lastPing(): number | null {
    return this._lastPing;
  }

  get lastFailure(): number | null {
    return this._lastFailure;
  }

  get reconnectCount(): number {
    return this._reconnectCount;
  }

  get latency(): number | null {
    return this._latency;
  }

  set onRedisUp(cb: (() => void) | null) {
    this._onRedisUp = cb;
  }

  set onRedisDown(cb: (() => void) | null) {
    this._onRedisDown = cb;
  }

  getMetrics(): RedisHealthMetrics {
    return {
      status: this._status,
      latency: this._latency,
      lastPing: this._lastPing,
      lastFailure: this._lastFailure,
      reconnectCount: this._reconnectCount,
    };
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.checkInterval);
  }

  private async ping(): Promise<void> {
    try {
      const start = Date.now();
      await this.redis.ping();
      this._latency = Date.now() - start;
      this._lastPing = Date.now();

      if (this._wasDown) {
        this._consecutiveSuccesses++;

        if (this._consecutiveSuccesses === 1) {
          this.logger.log('Redis Recovery Started');
        }

        if (this._consecutiveSuccesses >= this.STABILIZATION_THRESHOLD) {
          this._status = 'connected';
          this._wasDown = false;
          this._reconnectCount++;
          this._consecutiveSuccesses = 0;
          this.logger.log('Redis Recovery Verified');
          this._onRedisUp?.();
        }
      } else {
        this._status = 'connected';
      }
    } catch {
      this._lastFailure = Date.now();
      this._status = 'disconnected';
      this._consecutiveSuccesses = 0;
      if (!this._wasDown) {
        this._wasDown = true;
        this.logger.warn('Redis Disconnected');
        this._onRedisDown?.();
      }
    }
  }
}