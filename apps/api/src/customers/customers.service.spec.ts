import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { CustomersService } from './customers.service';
import { PrismaService } from '../prisma/prisma.service';

const ORG_ID = 'org-1';
const OTHER_ORG = 'org-2';

const p2025 = () =>
  new Prisma.PrismaClientKnownRequestError('Record not found', {
    code: 'P2025',
    clientVersion: '6.0.0',
    meta: {},
  });

const buildService = (overrides: Record<string, jest.Mock> = {}) => {
  const customerFindMany = overrides.customerFindMany ?? jest.fn().mockResolvedValue([]);
  const customerCount = overrides.customerCount ?? jest.fn().mockResolvedValue(0);
  const customerFindFirst = overrides.customerFindFirst ?? jest.fn();
  const customerCreate = overrides.customerCreate ?? jest.fn();
  const customerUpdate = overrides.customerUpdate ?? jest.fn();
  const customerUpdateMany = overrides.customerUpdateMany ?? jest.fn();
  const auditRecord = overrides.auditRecord ?? jest.fn().mockResolvedValue(undefined);

  const service = new CustomersService({
    customer: {
      findMany: customerFindMany,
      count: customerCount,
      findFirst: customerFindFirst,
      create: customerCreate,
      update: customerUpdate,
      updateMany: customerUpdateMany,
    },
  } as unknown as PrismaService, {
    record: auditRecord,
  } as never);

  return {
    service,
    customerFindMany,
    customerCount,
    customerFindFirst,
    customerCreate,
    customerUpdate,
    customerUpdateMany,
    auditRecord,
  };
};

describe('CustomersService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('findAll - pagination and search', () => {
    it('returns paginated results with meta', async () => {
      const { service, customerCount, customerFindMany } = buildService();
      customerCount.mockResolvedValue(25);
      customerFindMany.mockResolvedValue([
        { id: 'c1', name: 'Acme', email: 'acme@test.com', isActive: true, createdAt: new Date(), updatedAt: new Date() },
      ]);

      const result = await service.findAll(ORG_ID, { page: 2, limit: 10 });

      expect(result.meta).toEqual({ total: 25, page: 2, limit: 10, totalPages: 3 });
      expect(result.data).toHaveLength(1);
      expect(customerFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('applies search filter with OR on name/email/phone/company', async () => {
      const { service, customerFindMany } = buildService();
      customerFindMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, { search: 'acme' });

      const whereArg = customerFindMany.mock.calls[0][0].where;
      expect(whereArg.OR).toEqual([
        { name: { contains: 'acme', mode: 'insensitive' } },
        { email: { contains: 'acme', mode: 'insensitive' } },
        { phone: { contains: 'acme', mode: 'insensitive' } },
        { company: { contains: 'acme', mode: 'insensitive' } },
      ]);
    });

    it('always includes organizationId in where clause', async () => {
      const { service, customerFindMany } = buildService();
      customerFindMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, {});

      const whereArg = customerFindMany.mock.calls[0][0].where;
      expect(whereArg.organizationId).toBe(ORG_ID);
      expect(whereArg.deletedAt).toBeNull();
    });

    it('applies isActive filter', async () => {
      const { service, customerFindMany } = buildService();
      customerFindMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, { isActive: false });

      const whereArg = customerFindMany.mock.calls[0][0].where;
      expect(whereArg.isActive).toBe(false);
    });

    it('applies sorting with allowed fields', async () => {
      const { service, customerFindMany } = buildService();
      customerFindMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, { sortBy: 'name', sortOrder: 'asc' });

      expect(customerFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: 'asc' } }),
      );
    });

    it('falls back to createdAt for disallowed sort field', async () => {
      const { service, customerFindMany } = buildService();
      customerFindMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, { sortBy: 'evilField', sortOrder: 'desc' });

      expect(customerFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('search is sanitized (trimmed)', async () => {
      const { service, customerFindMany } = buildService();
      customerFindMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, { search: '  acme  ' });

      const whereArg = customerFindMany.mock.calls[0][0].where;
      expect(whereArg.OR[0]).toEqual({ name: { contains: 'acme', mode: 'insensitive' } });
    });

    it('does not include OR when search is empty', async () => {
      const { service, customerFindMany } = buildService();
      customerFindMany.mockResolvedValue([]);

      await service.findAll(ORG_ID, {});

      const whereArg = customerFindMany.mock.calls[0][0].where;
      expect(whereArg.OR).toBeUndefined();
    });
  });

  describe('findById', () => {
    it('returns a customer in the same organization', async () => {
      const { service, customerFindFirst } = buildService();
      const mockCustomer = { id: 'c1', name: 'Acme', email: 'acme@test.com' };
      customerFindFirst.mockResolvedValue(mockCustomer);

      const result = await service.findById(ORG_ID, 'c1');

      expect(result).toEqual(mockCustomer);
      expect(customerFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c1', organizationId: ORG_ID, deletedAt: null },
        }),
      );
    });

    it('throws NotFoundException for non-existent customer', async () => {
      const { service, customerFindFirst } = buildService();
      customerFindFirst.mockResolvedValue(null);

      await expect(service.findById(ORG_ID, 'c-nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('trims and normalizes fields', async () => {
      const { service, customerCreate } = buildService();
      customerCreate.mockResolvedValue({ id: 'c1', name: 'Acme Corp', email: 'acme@test.com', isActive: true, createdAt: new Date() });

      await service.create(ORG_ID, 'u1', {
        name: '  Acme Corp  ',
        email: '  ACME@TEST.COM  ',
        phone: '  555-0100  ',
        company: '  Acme Inc  ',
      } as never);

      expect(customerCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Acme Corp',
            email: 'acme@test.com',
            phone: '555-0100',
            company: 'Acme Inc',
          }),
        }),
      );
    });

    it('connects to the correct organization', async () => {
      const { service, customerCreate } = buildService();
      customerCreate.mockResolvedValue({ id: 'c1', name: 'Acme', isActive: true, createdAt: new Date() });

      await service.create(ORG_ID, 'u1', { name: 'Acme' } as never);

      const createCall = customerCreate.mock.calls[0][0];
      expect(createCall.data.organization).toEqual({ connect: { id: ORG_ID } });
    });

    it('defaults isActive to true', async () => {
      const { service, customerCreate } = buildService();
      customerCreate.mockResolvedValue({ id: 'c1', name: 'Acme', isActive: true, createdAt: new Date() });

      await service.create(ORG_ID, 'u1', { name: 'Acme' } as never);

      const createCall = customerCreate.mock.calls[0][0];
      expect(createCall.data.isActive).toBe(true);
    });
  });

  describe('update - tenant scoping', () => {
    it('succeeds for a customer in the same organization', async () => {
      const { service, customerUpdate } = buildService();
      customerUpdate.mockResolvedValue({ id: 'c1', name: 'Acme', isActive: true, updatedAt: new Date() });

      const result = await service.update(ORG_ID, 'u1', 'c1', { name: 'Acme' } as never);

      expect(customerUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c1', organizationId: ORG_ID, deletedAt: null },
          data: expect.objectContaining({ name: 'Acme' }),
        }),
      );
      expect(result.name).toBe('Acme');
    });

    it('rejects a customer from another organization', async () => {
      const { service, customerUpdate } = buildService();
      customerUpdate.mockRejectedValue(p2025());

      await expect(service.update(ORG_ID, 'u1', 'c-other', { name: 'X' } as never)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('trims and normalizes fields on update', async () => {
      const { service, customerUpdate } = buildService();
      customerUpdate.mockResolvedValue({ id: 'c1', name: 'Acme', email: 'acme@test.com', isActive: true, updatedAt: new Date() });

      await service.update(ORG_ID, 'u1', 'c1', {
        name: '  Acme Corp  ',
        email: '  ACME@TEST.COM  ',
      } as never);

      expect(customerUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Acme Corp',
            email: 'acme@test.com',
          }),
        }),
      );
    });
  });

  describe('softDelete - tenant scoping', () => {
    it('succeeds for a customer in the same organization', async () => {
      const { service, customerUpdateMany } = buildService();
      customerUpdateMany.mockResolvedValue({ count: 1 });

      const result = await service.softDelete(ORG_ID, 'u1', 'c1');

      expect(customerUpdateMany).toHaveBeenCalledWith({
        where: { id: 'c1', organizationId: ORG_ID, deletedAt: null },
        data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }),
      });
      expect(result.message).toContain('deleted');
    });

    it('rejects a customer from another organization', async () => {
      const { service, customerUpdateMany } = buildService();
      customerUpdateMany.mockResolvedValue({ count: 0 });

      await expect(service.softDelete(ORG_ID, 'u1', 'c-other')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus - tenant scoping', () => {
    it('succeeds for a customer in the same organization', async () => {
      const { service, customerUpdate } = buildService();
      customerUpdate.mockResolvedValue({ id: 'c1', name: 'Acme', isActive: false, updatedAt: new Date() });

      const result = await service.updateStatus(ORG_ID, 'u1', 'c1', { isActive: false } as never);

      expect(customerUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c1', organizationId: ORG_ID, deletedAt: null },
          data: { isActive: false },
        }),
      );
      expect(result.isActive).toBe(false);
    });

    it('rejects a customer from another organization', async () => {
      const { service, customerUpdate } = buildService();
      customerUpdate.mockRejectedValue(p2025());

      await expect(
        service.updateStatus(ORG_ID, 'u1', 'c-other', { isActive: true } as never),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('tenant isolation', () => {
    it('never exposes customers from other organizations in findAll', async () => {
      const { service, customerFindMany } = buildService();
      customerFindMany.mockResolvedValue([{ id: 'c1', name: 'Org1 Customer' }]);

      await service.findAll(ORG_ID, {});

      const whereArg = customerFindMany.mock.calls[0][0].where;
      expect(whereArg.organizationId).toBe(ORG_ID);
      expect(whereArg.organizationId).not.toBe(OTHER_ORG);
    });

    it('never allows update of customer from another org', async () => {
      const { service, customerUpdate } = buildService();
      customerUpdate.mockRejectedValue(p2025());

      await expect(service.update(ORG_ID, 'u1', 'c-other', { name: 'Hacked' } as never)).rejects.toThrow();
    });
  });

  describe('audit logging', () => {
    it('records CUSTOMER_CREATED on successful create', async () => {
      const { service, customerCreate, auditRecord } = buildService();
      customerCreate.mockResolvedValue({ id: 'c1', name: 'Acme', isActive: true, createdAt: new Date() });

      await service.create(ORG_ID, 'u1', { name: 'Acme' } as never);

      expect(auditRecord).toHaveBeenCalledWith({
        userId: 'u1',
        organizationId: ORG_ID,
        action: 'CUSTOMER_CREATED',
        entity: 'Customer',
        entityId: 'c1',
        status: 'SUCCESS',
        metadata: { name: 'Acme' },
      });
    });

    it('records CUSTOMER_UPDATED on successful update', async () => {
      const { service, customerUpdate, auditRecord } = buildService();
      customerUpdate.mockResolvedValue({ id: 'c1', name: 'Updated', isActive: true, updatedAt: new Date() });

      await service.update(ORG_ID, 'u1', 'c1', { name: 'Updated' } as never);

      expect(auditRecord).toHaveBeenCalledWith({
        userId: 'u1',
        organizationId: ORG_ID,
        action: 'CUSTOMER_UPDATED',
        entity: 'Customer',
        entityId: 'c1',
        status: 'SUCCESS',
        metadata: { name: 'Updated', changes: ['name'] },
      });
    });

    it('records CUSTOMER_DELETED on successful softDelete', async () => {
      const { service, customerUpdateMany, auditRecord } = buildService();
      customerUpdateMany.mockResolvedValue({ count: 1 });

      await service.softDelete(ORG_ID, 'u1', 'c1');

      expect(auditRecord).toHaveBeenCalledWith({
        userId: 'u1',
        organizationId: ORG_ID,
        action: 'CUSTOMER_DELETED',
        entity: 'Customer',
        entityId: 'c1',
        status: 'SUCCESS',
      });
    });

    it('records CUSTOMER_STATUS_CHANGED on successful updateStatus', async () => {
      const { service, customerUpdate, auditRecord } = buildService();
      customerUpdate.mockResolvedValue({ id: 'c1', name: 'Acme', isActive: false, updatedAt: new Date() });

      await service.updateStatus(ORG_ID, 'u1', 'c1', { isActive: false } as never);

      expect(auditRecord).toHaveBeenCalledWith({
        userId: 'u1',
        organizationId: ORG_ID,
        action: 'CUSTOMER_STATUS_CHANGED',
        entity: 'Customer',
        entityId: 'c1',
        status: 'SUCCESS',
        metadata: { name: 'Acme', isActive: false },
      });
    });

    it('create still returns customer when audit logging is present', async () => {
      const { service, customerCreate } = buildService();
      customerCreate.mockResolvedValue({ id: 'c1', name: 'Acme', isActive: true, createdAt: new Date() });

      const result = await service.create(ORG_ID, 'u1', { name: 'Acme' } as never);

      expect(result.id).toBe('c1');
      expect(result.name).toBe('Acme');
    });
  });
});
