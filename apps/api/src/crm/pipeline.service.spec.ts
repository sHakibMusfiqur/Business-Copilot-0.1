import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { PipelineService } from './pipeline.service';

const ORG_ID = 'org-1';
const PIPELINE_ID = 'pipeline-1';
const PLATFORM_DEFAULT_ID = 'pipeline-default';

const mockService = () => {
  const pipelineFindFirst = jest.fn();
  const pipelineFindMany = jest.fn();
  const pipelineCount = jest.fn();
  const pipelineCreate = jest.fn();
  const pipelineUpdate = jest.fn();
  const pipelineUpdateMany = jest.fn();

  const service = new PipelineService({
    pipeline: {
      findFirst: pipelineFindFirst,
      findMany: pipelineFindMany,
      count: pipelineCount,
      create: pipelineCreate,
      update: pipelineUpdate,
      updateMany: pipelineUpdateMany,
    },
  } as unknown as PrismaService);

  pipelineFindFirst.mockResolvedValue({ id: PIPELINE_ID, organizationId: ORG_ID });
  pipelineCreate.mockResolvedValue({ id: PIPELINE_ID, name: 'Sales', organizationId: ORG_ID });
  pipelineUpdate.mockResolvedValue({ id: PIPELINE_ID, name: 'Sales', organizationId: ORG_ID });

  return {
    service,
    pipelineFindFirst,
    pipelineFindMany,
    pipelineCount,
    pipelineCreate,
    pipelineUpdate,
    pipelineUpdateMany,
  };
};

function prismaKnownError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('prisma error', {
    code,
    clientVersion: '6.19.3',
  });
}

describe('PipelineService.findAll (tenant isolation)', () => {
  it('returns org pipelines and the platform default pipeline', async () => {
    const { service, pipelineCount, pipelineFindMany } = mockService();
    pipelineCount.mockResolvedValue(2);
    pipelineFindMany.mockResolvedValue([{ id: PIPELINE_ID }, { id: PLATFORM_DEFAULT_ID }]);

    const result = await service.findAll(ORG_ID, {} as never);

    expect(pipelineCount).toHaveBeenCalledWith({
      where: { deletedAt: null, OR: [{ organizationId: ORG_ID }, { organizationId: null }] },
    });
    expect(pipelineFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, OR: [{ organizationId: ORG_ID }, { organizationId: null }] },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(result.meta).toEqual({ total: 2, page: 1, limit: 10, totalPages: 1 });
  });

  it('applies search across name and description', async () => {
    const { service, pipelineFindMany } = mockService();
    pipelineFindMany.mockResolvedValue([]);

    await service.findAll(ORG_ID, { search: '  sales  ' } as never);

    expect(pipelineFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: {
            OR: [
              { name: { contains: 'sales', mode: 'insensitive' } },
              { description: { contains: 'sales', mode: 'insensitive' } },
            ],
          },
        }),
      }),
    );
  });

  it('clamps unknown sort field to createdAt desc', async () => {
    const { service, pipelineFindMany } = mockService();
    pipelineFindMany.mockResolvedValue([]);

    await service.findAll(ORG_ID, { sortBy: 'notAField' } as never);

    expect(pipelineFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
  });
});

describe('PipelineService.findById', () => {
  it('returns an org-scoped pipeline', async () => {
    const { service, pipelineFindFirst } = mockService();
    pipelineFindFirst.mockResolvedValue({ id: PIPELINE_ID, organizationId: ORG_ID });

    const result = await service.findById(ORG_ID, PIPELINE_ID);

    expect(pipelineFindFirst).toHaveBeenCalledWith({
      where: {
        id: PIPELINE_ID,
        deletedAt: null,
        OR: [{ organizationId: ORG_ID }, { organizationId: null }],
      },
      select: expect.anything(),
    });
    expect(result.id).toBe(PIPELINE_ID);
  });

  it('allows reading the platform default pipeline', async () => {
    const { service, pipelineFindFirst } = mockService();
    pipelineFindFirst.mockResolvedValue({ id: PLATFORM_DEFAULT_ID, organizationId: null });

    const result = await service.findById(ORG_ID, PLATFORM_DEFAULT_ID);

    expect(result.id).toBe(PLATFORM_DEFAULT_ID);
  });

  it('throws NotFound for a cross-tenant or deleted pipeline', async () => {
    const { service, pipelineFindFirst } = mockService();
    pipelineFindFirst.mockResolvedValue(null);

    await expect(service.findById(ORG_ID, 'pipeline-other')).rejects.toThrow(NotFoundException);
  });
});

describe('PipelineService.create', () => {
  it('creates an org-scoped pipeline and normalizes the name', async () => {
    const { service, pipelineCreate } = mockService();
    pipelineCreate.mockResolvedValue({ id: PIPELINE_ID, name: 'Sales', organizationId: ORG_ID });

    await service.create(ORG_ID, 'actor', { name: ' Sales ' } as never);

    expect(pipelineCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Sales',
        organizationId: ORG_ID,
        isDefault: false,
        isActive: true,
      }),
      select: expect.anything(),
    });
  });

  it('clears other org defaults when creating a new default pipeline', async () => {
    const { service, pipelineUpdateMany, pipelineCreate } = mockService();

    await service.create(ORG_ID, 'actor', { name: 'Sales', isDefault: true } as never);

    expect(pipelineUpdateMany).toHaveBeenCalledWith({
      where: { organizationId: ORG_ID, deletedAt: null, isDefault: true },
      data: { isDefault: false },
    });
    expect(pipelineCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isDefault: true }),
      }),
    );
  });

  it('rejects an inactive default pipeline', async () => {
    const { service, pipelineCreate } = mockService();

    await expect(
      service.create(ORG_ID, 'actor', { name: 'Sales', isDefault: true, isActive: false } as never),
    ).rejects.toThrow(BadRequestException);
    expect(pipelineCreate).not.toHaveBeenCalled();
  });
});

describe('PipelineService.update', () => {
  it('updates an org-scoped pipeline', async () => {
    const { service, pipelineUpdate } = mockService();
    pipelineUpdate.mockResolvedValue({ id: PIPELINE_ID, name: 'New', organizationId: ORG_ID });

    await service.update(ORG_ID, 'actor', PIPELINE_ID, { name: ' New ' } as never);

    expect(pipelineUpdate).toHaveBeenCalledWith({
      where: { id: PIPELINE_ID, organizationId: ORG_ID, deletedAt: null },
      data: expect.objectContaining({ name: 'New' }),
      select: expect.anything(),
    });
  });

  it('rejects updating the platform default pipeline', async () => {
    const { service, pipelineFindFirst, pipelineUpdate } = mockService();
    pipelineFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: PLATFORM_DEFAULT_ID });

    await expect(
      service.update(ORG_ID, 'actor', PLATFORM_DEFAULT_ID, { name: 'X' } as never),
    ).rejects.toThrow(ForbiddenException);
    expect(pipelineUpdate).not.toHaveBeenCalled();
  });

  it('throws NotFound for a cross-tenant pipeline', async () => {
    const { service, pipelineFindFirst, pipelineUpdate } = mockService();
    pipelineFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await expect(
      service.update(ORG_ID, 'actor', 'pipeline-other', { name: 'X' } as never),
    ).rejects.toThrow(NotFoundException);
    expect(pipelineUpdate).not.toHaveBeenCalled();
  });

  it('clears other org defaults when setting isDefault true', async () => {
    const { service, pipelineFindFirst, pipelineUpdateMany, pipelineUpdate } = mockService();
    pipelineFindFirst.mockResolvedValue({ id: PIPELINE_ID, isActive: true, isDefault: false });
    pipelineUpdate.mockResolvedValue({ id: PIPELINE_ID, name: 'Sales' });

    await service.update(ORG_ID, 'actor', PIPELINE_ID, { isDefault: true } as never);

    expect(pipelineUpdateMany).toHaveBeenCalledWith({
      where: { organizationId: ORG_ID, deletedAt: null, isDefault: true, id: { not: PIPELINE_ID } },
      data: { isDefault: false },
    });
  });

  it('rejects making an inactive pipeline the default', async () => {
    const { service, pipelineFindFirst, pipelineUpdate } = mockService();
    pipelineFindFirst.mockResolvedValue({ id: PIPELINE_ID, isActive: false, isDefault: false });

    await expect(
      service.update(ORG_ID, 'actor', PIPELINE_ID, { isDefault: true } as never),
    ).rejects.toThrow(BadRequestException);
    expect(pipelineUpdate).not.toHaveBeenCalled();
  });

  it('rejects deactivating the current default pipeline', async () => {
    const { service, pipelineFindFirst, pipelineUpdate } = mockService();
    pipelineFindFirst.mockResolvedValue({ id: PIPELINE_ID, isActive: true, isDefault: true });

    await expect(
      service.update(ORG_ID, 'actor', PIPELINE_ID, { isActive: false } as never),
    ).rejects.toThrow(BadRequestException);
    expect(pipelineUpdate).not.toHaveBeenCalled();
  });

  it('allows deactivating a non-default pipeline', async () => {
    const { service, pipelineFindFirst, pipelineUpdate } = mockService();
    pipelineFindFirst.mockResolvedValue({ id: PIPELINE_ID, isActive: true, isDefault: false });
    pipelineUpdate.mockResolvedValue({ id: PIPELINE_ID, isActive: false, isDefault: false });

    await service.update(ORG_ID, 'actor', PIPELINE_ID, { isActive: false } as never);

    expect(pipelineUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PIPELINE_ID, organizationId: ORG_ID, deletedAt: null },
        data: expect.objectContaining({ isActive: false }),
      }),
    );
  });

  it('allows deactivating the default when isDefault is also cleared', async () => {
    const { service, pipelineFindFirst, pipelineUpdate } = mockService();
    pipelineFindFirst.mockResolvedValue({ id: PIPELINE_ID, isActive: true, isDefault: true });
    pipelineUpdate.mockResolvedValue({ id: PIPELINE_ID, isActive: false, isDefault: false });

    await service.update(ORG_ID, 'actor', PIPELINE_ID, { isActive: false, isDefault: false } as never);

    expect(pipelineUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PIPELINE_ID, organizationId: ORG_ID, deletedAt: null },
        data: expect.objectContaining({ isActive: false, isDefault: false }),
      }),
    );
  });

  it('maps P2025 to NotFound', async () => {
    const { service, pipelineFindFirst, pipelineUpdate } = mockService();
    pipelineFindFirst.mockResolvedValue({ id: PIPELINE_ID, isActive: true, isDefault: false });
    pipelineUpdate.mockRejectedValue(prismaKnownError('P2025'));

    await expect(
      service.update(ORG_ID, 'actor', PIPELINE_ID, { name: 'X' } as never),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('PipelineService.softDelete', () => {
  it('soft deletes an org-scoped pipeline', async () => {
    const { service, pipelineFindFirst, pipelineUpdate } = mockService();

    await service.softDelete(ORG_ID, 'actor', PIPELINE_ID);

    expect(pipelineFindFirst).toHaveBeenCalledWith({
      where: { id: PIPELINE_ID, organizationId: ORG_ID, deletedAt: null },
      select: { id: true },
    });
    expect(pipelineUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PIPELINE_ID, organizationId: ORG_ID, deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      }),
    );
  });

  it('forbids deleting the platform default pipeline', async () => {
    const { service, pipelineFindFirst, pipelineUpdate } = mockService();
    pipelineFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: PLATFORM_DEFAULT_ID });

    await expect(service.softDelete(ORG_ID, 'actor', PLATFORM_DEFAULT_ID)).rejects.toThrow(
      ForbiddenException,
    );
    expect(pipelineUpdate).not.toHaveBeenCalled();
  });

  it('throws NotFound for a cross-tenant pipeline', async () => {
    const { service, pipelineFindFirst, pipelineUpdate } = mockService();
    pipelineFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await expect(service.softDelete(ORG_ID, 'actor', 'pipeline-other')).rejects.toThrow(
      NotFoundException,
    );
    expect(pipelineUpdate).not.toHaveBeenCalled();
  });

  it('throws NotFound when the pipeline is already soft-deleted', async () => {
    const { service, pipelineFindFirst, pipelineUpdate } = mockService();
    pipelineFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await expect(service.softDelete(ORG_ID, 'actor', PIPELINE_ID)).rejects.toThrow(NotFoundException);
    expect(pipelineUpdate).not.toHaveBeenCalled();
  });
});