import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;
  let auditLogCreate: jest.Mock;

  beforeEach(() => {
    auditLogCreate = jest.fn().mockResolvedValue({});
    service = new AuditService({
      auditLog: { create: auditLogCreate },
    } as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('metadata sanitization', () => {
    it('strips sensitive keys from metadata', async () => {
      await service.record({
        userId: 'u1',
        organizationId: 'o1',
        action: 'TEST_ACTION',
        metadata: {
          orderNumber: 'SO-001',
          password: 'hunter2',
          passwordHash: 'abc123',
          token: 'jwt-secret',
          accessToken: 'access-val',
          refreshToken: 'refresh-val',
          secret: 'my-secret',
          apiKey: 'key-123',
          authorization: 'Bearer xxx',
          cookie: 'session=abc',
          safeField: 'keep-this',
        },
      });

      expect(auditLogCreate).toHaveBeenCalledTimes(1);
      const savedMetadata = auditLogCreate.mock.calls[0][0].data.metadata;
      expect(savedMetadata).toEqual({
        orderNumber: 'SO-001',
        safeField: 'keep-this',
      });
      expect(savedMetadata).not.toHaveProperty('password');
      expect(savedMetadata).not.toHaveProperty('passwordHash');
      expect(savedMetadata).not.toHaveProperty('token');
      expect(savedMetadata).not.toHaveProperty('accessToken');
      expect(savedMetadata).not.toHaveProperty('refreshToken');
      expect(savedMetadata).not.toHaveProperty('secret');
      expect(savedMetadata).not.toHaveProperty('apiKey');
      expect(savedMetadata).not.toHaveProperty('authorization');
      expect(savedMetadata).not.toHaveProperty('cookie');
    });

    it('returns empty object when metadata is undefined', async () => {
      await service.record({
        userId: 'u1',
        action: 'TEST_ACTION',
      });

      const savedMetadata = auditLogCreate.mock.calls[0][0].data.metadata;
      expect(savedMetadata).toEqual({});
    });

    it('preserves legitimate business metadata', async () => {
      await service.record({
        userId: 'u1',
        organizationId: 'o1',
        action: 'SALES_ORDER_SUBMITTED',
        entity: 'SalesOrder',
        entityId: 'sale-1',
        metadata: { orderNumber: 'SO-2026-000001', total: 1500 },
      });

      const savedMetadata = auditLogCreate.mock.calls[0][0].data.metadata;
      expect(savedMetadata).toEqual({
        orderNumber: 'SO-2026-000001',
        total: 1500,
      });
    });

    it('strips case-insensitive sensitive keys', async () => {
      await service.record({
        userId: 'u1',
        action: 'TEST_ACTION',
        metadata: {
          Password: 'val1',
          PASSWORD: 'val2',
          Token: 'val3',
          TOKEN: 'val4',
          ApiKey: 'val5',
          SECRET: 'val6',
          safe: 'keep',
        },
      });

      const savedMetadata = auditLogCreate.mock.calls[0][0].data.metadata;
      expect(savedMetadata).toEqual({ safe: 'keep' });
      expect(savedMetadata).not.toHaveProperty('Password');
      expect(savedMetadata).not.toHaveProperty('PASSWORD');
      expect(savedMetadata).not.toHaveProperty('Token');
      expect(savedMetadata).not.toHaveProperty('TOKEN');
      expect(savedMetadata).not.toHaveProperty('ApiKey');
      expect(savedMetadata).not.toHaveProperty('SECRET');
    });
  });
});
