import { ConfigService } from '../../config/config.service';
import { RedisService } from './redis.service';

describe('RedisService', () => {
  describe('when REDIS_URL is not set', () => {
    it('is disabled, returns null client, and all operations no-op safely', async () => {
      const config = { redisUrl: '' } as unknown as ConfigService;
      const service = new RedisService(config);

      expect(service.isEnabled()).toBe(false);
      expect(service.getClient()).toBeNull();

      await expect(service.get('missing')).resolves.toBeNull();
      await expect(service.set('k', { a: 1 })).resolves.toBeUndefined();
      await expect(service.delete('k')).resolves.toBeUndefined();
      await expect(service.exists('k')).resolves.toBe(false);
      await expect(service.ping()).resolves.toBe(false);
      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    });
  });

  describe('when REDIS_URL throws (getEnv behavior)', () => {
    it('treats the service as disabled instead of crashing at construction', async () => {
      const config = {
        get redisUrl() {
          throw new Error('Environment variable REDIS_URL is not defined');
        },
      } as unknown as ConfigService;

      const service = new RedisService(config);

      expect(service.isEnabled()).toBe(false);
      expect(service.getClient()).toBeNull();
      await expect(service.get('k')).resolves.toBeNull();
    });
  });

  describe('key scoping', () => {
    it('namespaces keys under an organization', () => {
      const config = { redisUrl: '' } as unknown as ConfigService;
      const service = new RedisService(config);

      expect(service.organizationKey('org-123', 'widgets')).toBe(
        'organization:org-123:widgets',
      );
    });
  });

  describe('when REDIS_URL is set', () => {
    let service: RedisService;
    let redisUrl: string;

    beforeAll(() => {
      redisUrl = process.env.TEST_REDIS_URL || '';
    });

    afterEach(async () => {
      if (service) {
        await service.onModuleDestroy();
      }
    });

    it('enables the service and creates exactly one client', () => {
      if (!redisUrl) return;

      service = new RedisService({ redisUrl } as unknown as ConfigService);

      expect(service.isEnabled()).toBe(true);
      expect(service.getClient()).not.toBeNull();
    });

    it('round-trips JSON values with and without TTL', async () => {
      if (!redisUrl) return;

      service = new RedisService({ redisUrl } as unknown as ConfigService);
      const key = `redis-spec:roundtrip:${Date.now()}`;

      await service.set(key, { name: 'Acme', count: 3 });
      await expect(service.get<{ name: string; count: number }>(key)).resolves.toEqual({
        name: 'Acme',
        count: 3,
      });
      await expect(service.exists(key)).resolves.toBe(true);

      await service.set(`${key}:ttl`, { ttl: true }, { ttlSeconds: 60 });
      await expect(service.get(`${key}:ttl`)).resolves.toEqual({ ttl: true });

      await service.delete(key);
      await service.delete(`${key}:ttl`);
      await expect(service.get(key)).resolves.toBeNull();
      await expect(service.exists(key)).resolves.toBe(false);
    });

    it('answers ping truthfully', async () => {
      if (!redisUrl) return;

      service = new RedisService({ redisUrl } as unknown as ConfigService);
      await expect(service.ping()).resolves.toBe(true);
    });
  });
});
