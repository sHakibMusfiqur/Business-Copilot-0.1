import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { CustomersService } from './customers.service';
import { PrismaService } from '../prisma/prisma.service';

const ORG_ID = 'org-1';

const p2025 = () =>
  new Prisma.PrismaClientKnownRequestError('Record not found', {
    code: 'P2025',
    clientVersion: '5.0.0',
    meta: {},
  });

const mockService = () => {
  const customerFindMany = jest.fn();
  const customerCount = jest.fn();
  const customerFindFirst = jest.fn();
  const customerCreate = jest.fn();
  const customerUpdate = jest.fn();
  const customerUpdateMany = jest.fn();

  const service = new CustomersService({
    customer: {
      findMany: customerFindMany,
      count: customerCount,
      findFirst: customerFindFirst,
      create: customerCreate,
      update: customerUpdate,
      updateMany: customerUpdateMany,
    },
  } as unknown as PrismaService);

  return {
    service,
    customerFindMany,
    customerCount,
    customerFindFirst,
    customerCreate,
    customerUpdate,
    customerUpdateMany,
  };
};

describe('CustomersService mutation tenant scoping (FS6-2)', () => {
  it('update succeeds for a customer in the same organization', async () => {
    const { service, customerUpdate } = mockService();
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

  it('update rejects a customer from another organization', async () => {
    const { service, customerUpdate } = mockService();
    customerUpdate.mockRejectedValue(p2025());

    await expect(service.update(ORG_ID, 'u1', 'c-other', { name: 'X' } as never)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('softDelete succeeds for a customer in the same organization', async () => {
    const { service, customerUpdateMany } = mockService();
    customerUpdateMany.mockResolvedValue({ count: 1 });

    const result = await service.softDelete(ORG_ID, 'u1', 'c1');

    expect(customerUpdateMany).toHaveBeenCalledWith({
      where: { id: 'c1', organizationId: ORG_ID, deletedAt: null },
      data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }),
    });
    expect(result.message).toContain('deleted');
  });

  it('softDelete rejects a customer from another organization', async () => {
    const { service, customerUpdateMany } = mockService();
    customerUpdateMany.mockResolvedValue({ count: 0 });

    await expect(service.softDelete(ORG_ID, 'u1', 'c-other')).rejects.toThrow(NotFoundException);
  });

  it('updateStatus succeeds for a customer in the same organization', async () => {
    const { service, customerUpdate } = mockService();
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

  it('updateStatus rejects a customer from another organization', async () => {
    const { service, customerUpdate } = mockService();
    customerUpdate.mockRejectedValue(p2025());

    await expect(
      service.updateStatus(ORG_ID, 'u1', 'c-other', { isActive: true } as never),
    ).rejects.toThrow(NotFoundException);
  });
});