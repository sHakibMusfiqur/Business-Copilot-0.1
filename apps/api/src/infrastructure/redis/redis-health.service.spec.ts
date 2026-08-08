import { EventEmitter } from 'events';
import type Redis from 'ioredis';

import { RedisHealthService } from './redis-health.service';

function createFakeRedis(opts?: { pingReject: boolean }): { redis: Redis; ping: jest.Mock } {
  const redis = new EventEmitter() as Redis & EventEmitter;
  const ping = jest.fn(() =>
    Promise.resolve(opts?.pingReject ? Promise.reject(new Error('down')) : 'PONG'),
  );
  redis.ping = ping as unknown as Redis['ping'];
  return { redis, ping };
}

describe('RedisHealthService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('lifecycle cleanup', () => {
    it('stops pinging after onModuleDestroy() clears the interval', async () => {
      const { redis, ping } = createFakeRedis();
      const service = new RedisHealthService(redis);

      jest.advanceTimersByTime(10_000);
      expect(ping).toHaveBeenCalledTimes(1);

      await service.onModuleDestroy();

      jest.advanceTimersByTime(60_000);
      expect(ping).toHaveBeenCalledTimes(1);
    });

    it('onModuleDestroy is idempotent and does not throw', async () => {
      const { redis } = createFakeRedis();
      const service = new RedisHealthService(redis);

      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    });
  });

  describe('initial status truthfulness', () => {
    it('reports connected when the client is ready before the first ping interval', () => {
      const { redis } = createFakeRedis();
      const service = new RedisHealthService(redis);

      expect(service.status).toBe('disconnected');

      redis.emit('ready');

      expect(service.status).toBe('connected');
    });

    it("keeps disconnected status on 'ready' while recovering from a previous outage", () => {
      const { redis } = createFakeRedis();
      const service = new RedisHealthService(redis);

      redis.emit('close');
      expect(service.status).toBe('disconnected');

      redis.emit('ready');

      expect(service.status).toBe('disconnected');
    });
  });

  describe('health metrics', () => {
    it('wires onRedisDown callback on close', () => {
      const { redis } = createFakeRedis();
      const service = new RedisHealthService(redis);
      const onDown = jest.fn();
      service.onRedisDown = onDown;
      service.onRedisUp = jest.fn();

      redis.emit('close');

      expect(service.status).toBe('disconnected');
      expect(onDown).toHaveBeenCalledTimes(1);
    });

    it('recovers to connected after the stabilization threshold of successful pings', async () => {
      const { redis } = createFakeRedis();
      const service = new RedisHealthService(redis);
      const onUp = jest.fn();
      service.onRedisUp = onUp;

      redis.emit('close');
      expect(service.status).toBe('disconnected');

      // OnModuleDestroy must not be required for pings to progress. Each async
      // ping needs its microtasks flushed, so advance timers asynchronously.
      for (let i = 0; i < 5; i++) {
        await jest.advanceTimersByTimeAsync(10_000);
      }

      expect(service.status).toBe('connected');
      expect(onUp).toHaveBeenCalledTimes(1);
      expect(service.reconnectCount).toBe(1);

      await service.onModuleDestroy();
    });

    it('returns metrics reflecting current state', () => {
      const { redis } = createFakeRedis();
      const service = new RedisHealthService(redis);

      redis.emit('ready');
      const metrics = service.getMetrics();

      expect(metrics.status).toBe('connected');
      expect(metrics.latency).toBeNull();
      expect(metrics.lastPing).toBeNull();
      expect(metrics.lastFailure).toBeNull();
      expect(metrics.reconnectCount).toBe(0);
    });
  });
});