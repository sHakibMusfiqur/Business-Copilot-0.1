import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { SuppliersService } from './suppliers.service';
import { PrismaService } from '../prisma/prisma.service';

const ORG_ID = 'org-1';

const p2025 = () =>
  new Prisma.PrismaClientKnownRequestError('Record not found', {
    code: 'P2025',
    clientVersion: '5.0.0',
    meta: {},
  });

const mockService = () => {
  const supplierFindMany = jest.fn();
  const supplierCount = jest.fn();
  const supplierFindFirst = jest.fn();
  const supplierCreate = jest.fn();
  const supplierUpdate = jest.fn();
  const supplierUpdateMany = jest.fn();

  const service = new SuppliersService({
    supplier: {
      findMany: supplierFindMany,
      count: supplierCount,
      findFirst: supplierFindFirst,
      create: supplierCreate,
      update: supplierUpdate,
      updateMany: supplierUpdateMany,
    },
  } as unknown as PrismaService);

  return {
    service,
    supplierFindMany,
    supplierCount,
    supplierFindFirst,
    supplierCreate,
    supplierUpdate,
    supplierUpdateMany,
  };
};

describe('SuppliersService mutation tenant scoping (FS6-2)', () => {
  it('update succeeds for a supplier in the same organization', async () => {
    const { service, supplierUpdate } = mockService();
    supplierUpdate.mockResolvedValue({ id: 's1', name: 'Vendor', isActive: true, updatedAt: new Date() });

    const result = await service.update(ORG_ID, 'u1', 's1', { name: 'Vendor' } as never);

    expect(supplierUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's1', organizationId: ORG_ID, deletedAt: null },
        data: expect.objectContaining({ name: 'Vendor' }),
      }),
    );
    expect(result.name).toBe('Vendor');
  });

  it('update rejects a supplier from another organization', async () => {
    const { service, supplierUpdate } = mockService();
    supplierUpdate.mockRejectedValue(p2025());

    await expect(service.update(ORG_ID, 'u1', 's-other', { name: 'X' } as never)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('softDelete succeeds for a supplier in the same organization', async () => {
    const { service, supplierUpdateMany } = mockService();
    supplierUpdateMany.mockResolvedValue({ count: 1 });

    const result = await service.softDelete(ORG_ID, 'u1', 's1');

    expect(supplierUpdateMany).toHaveBeenCalledWith({
      where: { id: 's1', organizationId: ORG_ID, deletedAt: null },
      data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }),
    });
    expect(result.message).toContain('deleted');
  });

  it('softDelete rejects a supplier from another organization', async () => {
    const { service, supplierUpdateMany } = mockService();
    supplierUpdateMany.mockResolvedValue({ count: 0 });

    await expect(service.softDelete(ORG_ID, 'u1', 's-other')).rejects.toThrow(NotFoundException);
  });

  it('updateStatus succeeds for a supplier in the same organization', async () => {
    const { service, supplierUpdate } = mockService();
    supplierUpdate.mockResolvedValue({ id: 's1', name: 'Vendor', isActive: false, updatedAt: new Date() });

    const result = await service.updateStatus(ORG_ID, 'u1', 's1', { isActive: false } as never);

    expect(supplierUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's1', organizationId: ORG_ID, deletedAt: null },
        data: { isActive: false },
      }),
    );
    expect(result.isActive).toBe(false);
  });

  it('updateStatus rejects a supplier from another organization', async () => {
    const { service, supplierUpdate } = mockService();
    supplierUpdate.mockRejectedValue(p2025());

    await expect(
      service.updateStatus(ORG_ID, 'u1', 's-other', { isActive: true } as never),
    ).rejects.toThrow(NotFoundException);
  });
});