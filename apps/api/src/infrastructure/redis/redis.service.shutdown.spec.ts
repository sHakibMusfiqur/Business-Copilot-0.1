import { ConfigService } from '../../config/config.service';
import { RedisService } from './redis.service';

const mockQuit = jest.fn();
const mockDisconnect = jest.fn();

jest.mock('ioredis', () => {
  const MockRedis = jest.fn().mockImplementation(() => {
    const instance: Record<string, unknown> = {
      on: jest.fn().mockReturnValue(null),
      connect: jest.fn().mockResolvedValue(undefined),
      quit: mockQuit,
      disconnect: mockDisconnect,
    };
    return instance;
  });
  return { __esModule: true, default: MockRedis };
});


describe('RedisService shutdown (open-handle regression)', () => {
  function makeService(): RedisService {
    const config = { redisUrl: 'redis://localhost:6379' } as unknown as ConfigService;
    return new RedisService(config);
  }

  beforeEach(() => {
    mockQuit.mockReset();
    mockDisconnect.mockReset();
  });

  it('gracefully quits and then force-disconnects the client', async () => {
    mockQuit.mockResolvedValue('OK');

    const service = makeService();
    await service.onModuleDestroy();

    expect(mockQuit).toHaveBeenCalledTimes(1);
    // disconnect() releases the socket/backlog so the loop cannot stay open.
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('force-disconnects without throwing when the graceful quit fails', async () => {
    mockQuit.mockRejectedValue(new Error('socket hang up'));

    const service = makeService();
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();

    // Even when the connection is already broken, the client is released so no
    // TCP socket or reconnect timer can keep the process alive.
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });
});