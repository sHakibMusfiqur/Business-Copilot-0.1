import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { PipelineStageService } from './pipeline-stage.service';

const ORG_ID = 'org-1';
const PIPELINE_ID = 'pipeline-1';
const PLATFORM_DEFAULT_ID = 'pipeline-default';
const STAGE_ID = 'stage-1';

const mockService = () => {
  const pipelineFindFirst = jest.fn();
  const pipelineStageFindFirst = jest.fn();
  const pipelineStageFindMany = jest.fn();
  const pipelineStageCreate = jest.fn();
  const pipelineStageUpdate = jest.fn();

  const service = new PipelineStageService({
    pipeline: { findFirst: pipelineFindFirst },
    pipelineStage: {
      findFirst: pipelineStageFindFirst,
      findMany: pipelineStageFindMany,
      create: pipelineStageCreate,
      update: pipelineStageUpdate,
    },
  } as unknown as PrismaService);

  pipelineFindFirst.mockResolvedValue({ id: PIPELINE_ID, isActive: true });
  pipelineStageCreate.mockResolvedValue({ id: STAGE_ID, name: 'New', pipelineId: PIPELINE_ID });
  pipelineStageUpdate.mockResolvedValue({ id: STAGE_ID, name: 'New', pipelineId: PIPELINE_ID });

  return {
    service,
    pipelineFindFirst,
    pipelineStageFindFirst,
    pipelineStageFindMany,
    pipelineStageCreate,
    pipelineStageUpdate,
  };
};

function prismaKnownError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('prisma error', {
    code,
    clientVersion: '6.19.3',
  });
}

describe('PipelineStageService.findByPipeline', () => {
  it('lists non-deleted stages for an accessible pipeline', async () => {
    const { service, pipelineFindFirst, pipelineStageFindMany } = mockService();
    pipelineStageFindMany.mockResolvedValue([{ id: STAGE_ID, name: 'New' }]);

    const result = await service.findByPipeline(ORG_ID, PIPELINE_ID);

    expect(pipelineFindFirst).toHaveBeenCalledWith({
      where: {
        id: PIPELINE_ID,
        deletedAt: null,
        OR: [{ organizationId: ORG_ID }, { organizationId: null }],
      },
      select: { id: true },
    });
    expect(pipelineStageFindMany).toHaveBeenCalledWith({
      where: { pipelineId: PIPELINE_ID, deletedAt: null },
      select: expect.anything(),
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    expect(result).toEqual([{ id: STAGE_ID, name: 'New' }]);
  });

  it('allows listing stages of the platform default pipeline', async () => {
    const { service, pipelineFindFirst, pipelineStageFindMany } = mockService();
    pipelineFindFirst.mockResolvedValue({ id: PLATFORM_DEFAULT_ID });
    pipelineStageFindMany.mockResolvedValue([]);

    await service.findByPipeline(ORG_ID, PLATFORM_DEFAULT_ID);

    expect(pipelineFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: PLATFORM_DEFAULT_ID }) }),
    );
  });

  it('throws NotFound for an inaccessible pipeline', async () => {
    const { service, pipelineFindFirst, pipelineStageFindMany } = mockService();
    pipelineFindFirst.mockResolvedValue(null);

    await expect(service.findByPipeline(ORG_ID, 'pipeline-other')).rejects.toThrow(
      NotFoundException,
    );
    expect(pipelineStageFindMany).not.toHaveBeenCalled();
  });
});

describe('PipelineStageService.findById', () => {
  it('returns a stage belonging to an org pipeline', async () => {
    const { service, pipelineStageFindFirst } = mockService();
    pipelineStageFindFirst.mockResolvedValue({
      id: STAGE_ID,
      pipelineId: PIPELINE_ID,
      name: 'New',
      position: 0,
      isWon: false,
      isLost: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      pipeline: { organizationId: ORG_ID, deletedAt: null },
    });

    const result = await service.findById(ORG_ID, STAGE_ID);

    expect(result.id).toBe(STAGE_ID);
    expect(result.pipelineId).toBe(PIPELINE_ID);
  });

  it('allows reading a stage of the platform default pipeline', async () => {
    const { service, pipelineStageFindFirst } = mockService();
    pipelineStageFindFirst.mockResolvedValue({
      id: STAGE_ID,
      pipelineId: PLATFORM_DEFAULT_ID,
      name: 'New',
      position: 0,
      isWon: false,
      isLost: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      pipeline: { organizationId: null, deletedAt: null },
    });

    await expect(service.findById(ORG_ID, STAGE_ID)).resolves.toBeDefined();
  });

  it('throws NotFound for a stage in a deleted pipeline', async () => {
    const { service, pipelineStageFindFirst } = mockService();
    pipelineStageFindFirst.mockResolvedValue({
      id: STAGE_ID,
      pipeline: { organizationId: ORG_ID, deletedAt: new Date() },
    });

    await expect(service.findById(ORG_ID, STAGE_ID)).rejects.toThrow(NotFoundException);
  });

  it('throws NotFound for a stage from a cross-tenant pipeline', async () => {
    const { service, pipelineStageFindFirst } = mockService();
    pipelineStageFindFirst.mockResolvedValue({
      id: STAGE_ID,
      pipeline: { organizationId: 'org-other', deletedAt: null },
    });

    await expect(service.findById(ORG_ID, STAGE_ID)).rejects.toThrow(NotFoundException);
  });
});

describe('PipelineStageService.create', () => {
  it('creates a stage in an org pipeline', async () => {
    const { service, pipelineStageCreate } = mockService();

    await service.create(ORG_ID, 'actor', PIPELINE_ID, { name: ' New ' } as never);

    expect(pipelineStageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'New',
          position: 0,
          isWon: false,
          isLost: false,
          isActive: true,
          pipeline: { connect: { id: PIPELINE_ID } },
        }),
      }),
    );
  });

  it('forbids creating a stage in the platform default pipeline', async () => {
    const { service, pipelineFindFirst, pipelineStageCreate } = mockService();
    pipelineFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: PLATFORM_DEFAULT_ID });

    await expect(
      service.create(ORG_ID, 'actor', PLATFORM_DEFAULT_ID, { name: 'New' } as never),
    ).rejects.toThrow(ForbiddenException);
    expect(pipelineStageCreate).not.toHaveBeenCalled();
  });

  it('throws NotFound when the pipeline does not exist', async () => {
    const { service, pipelineFindFirst, pipelineStageCreate } = mockService();
    pipelineFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await expect(
      service.create(ORG_ID, 'actor', 'pipeline-other', { name: 'New' } as never),
    ).rejects.toThrow(NotFoundException);
    expect(pipelineStageCreate).not.toHaveBeenCalled();
  });

  it('rejects adding a stage to an inactive pipeline', async () => {
    const { service, pipelineFindFirst, pipelineStageCreate } = mockService();
    pipelineFindFirst.mockResolvedValue({ id: PIPELINE_ID, isActive: false });

    await expect(
      service.create(ORG_ID, 'actor', PIPELINE_ID, { name: 'New' } as never),
    ).rejects.toThrow(BadRequestException);
    expect(pipelineStageCreate).not.toHaveBeenCalled();
  });

  it('maps duplicate name (P2002) to ConflictException', async () => {
    const { service, pipelineStageCreate } = mockService();
    pipelineStageCreate.mockRejectedValue(prismaKnownError('P2002'));

    await expect(
      service.create(ORG_ID, 'actor', PIPELINE_ID, { name: 'New' } as never),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects a stage that is both won and lost', async () => {
    const { service, pipelineStageCreate } = mockService();

    await expect(
      service.create(ORG_ID, 'actor', PIPELINE_ID, { name: 'New', isWon: true, isLost: true } as never),
    ).rejects.toThrow(BadRequestException);
    expect(pipelineStageCreate).not.toHaveBeenCalled();
  });
});

describe('PipelineStageService.update', () => {
  it('updates a stage in an org pipeline', async () => {
    const { service, pipelineStageFindFirst, pipelineStageUpdate } = mockService();
    pipelineStageFindFirst.mockResolvedValue({
      id: STAGE_ID,
      pipeline: { id: PIPELINE_ID, organizationId: ORG_ID, deletedAt: null },
    });
    pipelineStageUpdate.mockResolvedValue({ id: STAGE_ID, name: 'Qualified' });

    await service.update(ORG_ID, 'actor', STAGE_ID, { name: ' Qualified ' } as never);

    expect(pipelineStageUpdate).toHaveBeenCalledWith({
      where: { id: STAGE_ID, deletedAt: null },
      data: expect.objectContaining({ name: 'Qualified' }),
      select: expect.anything(),
    });
  });

  it('forbids updating a platform default stage', async () => {
    const { service, pipelineStageFindFirst, pipelineStageUpdate } = mockService();
    pipelineStageFindFirst.mockResolvedValue({
      id: STAGE_ID,
      pipeline: { id: PLATFORM_DEFAULT_ID, organizationId: null, deletedAt: null },
    });

    await expect(
      service.update(ORG_ID, 'actor', STAGE_ID, { name: 'X' } as never),
    ).rejects.toThrow(ForbiddenException);
    expect(pipelineStageUpdate).not.toHaveBeenCalled();
  });

  it('throws NotFound for a cross-tenant stage', async () => {
    const { service, pipelineStageFindFirst, pipelineStageUpdate } = mockService();
    pipelineStageFindFirst.mockResolvedValue({
      id: STAGE_ID,
      pipeline: { id: 'pipeline-other', organizationId: 'org-other', deletedAt: null },
    });

    await expect(
      service.update(ORG_ID, 'actor', STAGE_ID, { name: 'X' } as never),
    ).rejects.toThrow(NotFoundException);
    expect(pipelineStageUpdate).not.toHaveBeenCalled();
  });

  it('maps duplicate name (P2002) to ConflictException', async () => {
    const { service, pipelineStageFindFirst, pipelineStageUpdate } = mockService();
    pipelineStageFindFirst.mockResolvedValue({
      id: STAGE_ID,
      pipeline: { id: PIPELINE_ID, organizationId: ORG_ID, deletedAt: null },
    });
    pipelineStageUpdate.mockRejectedValue(prismaKnownError('P2002'));

    await expect(
      service.update(ORG_ID, 'actor', STAGE_ID, { name: 'New' } as never),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects a stage that is both won and lost on update', async () => {
    const { service, pipelineStageFindFirst, pipelineStageUpdate } = mockService();
    pipelineStageFindFirst.mockResolvedValue({
      id: STAGE_ID,
      pipeline: { id: PIPELINE_ID, organizationId: ORG_ID, deletedAt: null },
    });

    await expect(
      service.update(ORG_ID, 'actor', STAGE_ID, { isWon: true, isLost: true } as never),
    ).rejects.toThrow(BadRequestException);
    expect(pipelineStageUpdate).not.toHaveBeenCalled();
  });
});

describe('PipelineStageService.softDelete', () => {
  it('soft deletes a stage in an org pipeline', async () => {
    const { service, pipelineStageFindFirst, pipelineStageUpdate } = mockService();
    pipelineStageFindFirst.mockResolvedValue({
      id: STAGE_ID,
      pipeline: { organizationId: ORG_ID, deletedAt: null },
    });

    await service.softDelete(ORG_ID, 'actor', STAGE_ID);

    expect(pipelineStageUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: STAGE_ID, deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      }),
    );
  });

  it('forbids deleting a platform default stage', async () => {
    const { service, pipelineStageFindFirst, pipelineStageUpdate } = mockService();
    pipelineStageFindFirst.mockResolvedValue({
      id: STAGE_ID,
      pipeline: { organizationId: null, deletedAt: null },
    });

    await expect(service.softDelete(ORG_ID, 'actor', STAGE_ID)).rejects.toThrow(ForbiddenException);
    expect(pipelineStageUpdate).not.toHaveBeenCalled();
  });

  it('throws NotFound for a cross-tenant stage', async () => {
    const { service, pipelineStageFindFirst, pipelineStageUpdate } = mockService();
    pipelineStageFindFirst.mockResolvedValue({
      id: STAGE_ID,
      pipeline: { organizationId: 'org-other', deletedAt: null },
    });

    await expect(service.softDelete(ORG_ID, 'actor', STAGE_ID)).rejects.toThrow(NotFoundException);
    expect(pipelineStageUpdate).not.toHaveBeenCalled();
  });
});