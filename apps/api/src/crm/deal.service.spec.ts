import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { DealService } from './deal.service';

const ORG_ID = 'org-1';
const DEAL_ID = 'deal-1';
const CONTACT_ID = 'contact-1';
const LEAD_ID = 'lead-1';
const OWNER_ID = 'owner-1';
const PIPELINE_ID = 'pipeline-default';
const STAGE_ID = 'stage-new';

const mockService = () => {
  const dealFindFirst = jest.fn();
  const dealFindMany = jest.fn();
  const dealCount = jest.fn();
  const dealCreate = jest.fn();
  const dealUpdate = jest.fn();
  const pipelineStageFindFirst = jest.fn();
  const pipelineFindFirst = jest.fn();
  const contactFindFirst = jest.fn();
  const leadFindFirst = jest.fn();
  const userFindFirst = jest.fn();

  const service = new DealService({
    deal: {
      findFirst: dealFindFirst,
      findMany: dealFindMany,
      count: dealCount,
      create: dealCreate,
      update: dealUpdate,
    },
    pipelineStage: { findFirst: pipelineStageFindFirst },
    pipeline: { findFirst: pipelineFindFirst },
    contact: { findFirst: contactFindFirst },
    lead: { findFirst: leadFindFirst },
    user: { findFirst: userFindFirst },
  } as unknown as PrismaService);

  dealFindFirst.mockResolvedValue({ id: DEAL_ID, organizationId: ORG_ID });
  dealCreate.mockResolvedValue({ id: DEAL_ID, title: 'Acme Deal', value: 1000 });
  dealUpdate.mockResolvedValue({ id: DEAL_ID, title: 'Acme Deal', value: 1000 });

  return {
    service,
    dealFindFirst,
    dealFindMany,
    dealCount,
    dealCreate,
    dealUpdate,
    pipelineStageFindFirst,
    pipelineFindFirst,
    contactFindFirst,
    leadFindFirst,
    userFindFirst,
  };
};

function prismaKnownError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('prisma error', {
    code,
    clientVersion: '6.19.3',
  });
}

describe('DealService.create (tenant isolation)', () => {
  it('scopes org and normalizes fields, converting value to Decimal', async () => {
    const { service, dealCreate } = mockService();
    dealCreate.mockResolvedValue({ id: DEAL_ID, title: 'Acme', value: 500, notes: 'x' });

    await service.create(ORG_ID, 'actor', {
      title: ' Acme ',
      value: 500,
      notes: '  hi  ',
    } as never);

    expect(dealCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: ORG_ID,
        title: 'Acme',
        notes: 'hi',
        contactId: null,
        leadId: null,
        ownerId: null,
      }),
      select: expect.anything(),
    });
    const call = dealCreate.mock.calls[0][0] as { data: { value: Prisma.Decimal } };
    expect(Number(call.data.value)).toBe(500);
  });
});

describe('DealService.create (relation tenant validation)', () => {
  it('associates contact/lead/owner from the same organization', async () => {
    const { service, contactFindFirst, leadFindFirst, userFindFirst, dealCreate } = mockService();
    contactFindFirst.mockResolvedValue({ id: CONTACT_ID });
    leadFindFirst.mockResolvedValue({ id: LEAD_ID });
    userFindFirst.mockResolvedValue({ id: OWNER_ID });
    dealCreate.mockResolvedValue({ id: DEAL_ID });

    await service.create(ORG_ID, 'actor', {
      title: 'Acme',
      contactId: CONTACT_ID,
      leadId: LEAD_ID,
      ownerId: OWNER_ID,
    } as never);

    expect(contactFindFirst).toHaveBeenCalledWith({
      where: { id: CONTACT_ID, organizationId: ORG_ID, deletedAt: null },
      select: { id: true },
    });
    expect(leadFindFirst).toHaveBeenCalledWith({
      where: { id: LEAD_ID, organizationId: ORG_ID, deletedAt: null },
      select: { id: true },
    });
    expect(userFindFirst).toHaveBeenCalledWith({
      where: { id: OWNER_ID, organizationId: ORG_ID, deletedAt: null },
      select: { id: true },
    });
    expect(dealCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contactId: CONTACT_ID,
          leadId: LEAD_ID,
          ownerId: OWNER_ID,
        }),
      }),
    );
  });

  it('rejects a cross-tenant contact', async () => {
    const { service, contactFindFirst, dealCreate } = mockService();
    contactFindFirst.mockResolvedValue(null);

    await expect(
      service.create(ORG_ID, 'actor', { title: 'Acme', contactId: CONTACT_ID } as never),
    ).rejects.toThrow(BadRequestException);
    expect(dealCreate).not.toHaveBeenCalled();
  });

  it('rejects a cross-tenant lead', async () => {
    const { service, leadFindFirst, dealCreate } = mockService();
    leadFindFirst.mockResolvedValue(null);

    await expect(
      service.create(ORG_ID, 'actor', { title: 'Acme', leadId: LEAD_ID } as never),
    ).rejects.toThrow(BadRequestException);
    expect(dealCreate).not.toHaveBeenCalled();
  });

  it('rejects a cross-tenant owner', async () => {
    const { service, userFindFirst, dealCreate } = mockService();
    userFindFirst.mockResolvedValue(null);

    await expect(
      service.create(ORG_ID, 'actor', { title: 'Acme', ownerId: OWNER_ID } as never),
    ).rejects.toThrow(BadRequestException);
    expect(dealCreate).not.toHaveBeenCalled();
  });
});

describe('DealService.create (pipeline/stage)', () => {
  it('accepts a platform default pipeline and its stage', async () => {
    const { service, pipelineFindFirst, pipelineStageFindFirst, dealCreate } = mockService();
    pipelineStageFindFirst.mockResolvedValue({ id: STAGE_ID, pipelineId: PIPELINE_ID, isActive: true });
    pipelineFindFirst.mockResolvedValue({ id: PIPELINE_ID });

    await service.create(ORG_ID, 'actor', {
      title: 'Acme',
      pipelineId: PIPELINE_ID,
      stageId: STAGE_ID,
    } as never);

    expect(dealCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pipelineId: PIPELINE_ID, stageId: STAGE_ID }),
      }),
    );
  });

  it('rejects a stage that does not belong to the selected pipeline', async () => {
    const { service, pipelineStageFindFirst, pipelineFindFirst, dealCreate } = mockService();
    pipelineStageFindFirst.mockResolvedValue({ id: STAGE_ID, pipelineId: 'pipeline-other', isActive: true });
    pipelineFindFirst.mockResolvedValue({ id: PIPELINE_ID });

    await expect(
      service.create(ORG_ID, 'actor', {
        title: 'Acme',
        pipelineId: PIPELINE_ID,
        stageId: STAGE_ID,
      } as never),
    ).rejects.toThrow(BadRequestException);
    expect(dealCreate).not.toHaveBeenCalled();
  });

  it('rejects a stage from an inaccessible pipeline', async () => {
    const { service, pipelineStageFindFirst, pipelineFindFirst, dealCreate } = mockService();
    pipelineStageFindFirst.mockResolvedValue({ id: STAGE_ID, pipelineId: PIPELINE_ID, isActive: true });
    pipelineFindFirst.mockResolvedValue(null);

    await expect(
      service.create(ORG_ID, 'actor', { title: 'Acme', stageId: STAGE_ID } as never),
    ).rejects.toThrow(BadRequestException);
    expect(dealCreate).not.toHaveBeenCalled();
  });

  it('rejects a stage that is not active or deleted', async () => {
    const { service, pipelineStageFindFirst, dealCreate } = mockService();
    pipelineStageFindFirst.mockResolvedValue(null);

    await expect(
      service.create(ORG_ID, 'actor', { title: 'Acme', stageId: STAGE_ID } as never),
    ).rejects.toThrow(BadRequestException);
    expect(dealCreate).not.toHaveBeenCalled();
  });
});

describe('DealService.create (default pipeline resolution)', () => {
  it('assigns the org default pipeline and its first active stage when none provided', async () => {
    const { service, pipelineFindFirst, pipelineStageFindFirst, dealCreate } = mockService();
    pipelineFindFirst.mockResolvedValueOnce({ id: 'pipeline-org-default' });
    pipelineStageFindFirst.mockResolvedValueOnce({ id: 'stage-first', pipelineId: 'pipeline-org-default' });
    dealCreate.mockResolvedValue({ id: DEAL_ID, title: 'Acme', value: 500 });

    await service.create(ORG_ID, 'actor', { title: 'Acme' } as never);

    expect(pipelineFindFirst).toHaveBeenCalledWith({
      where: {
        organizationId: ORG_ID,
        deletedAt: null,
        isActive: true,
        isDefault: true,
      },
      select: { id: true },
    });
    expect(pipelineStageFindFirst).toHaveBeenCalledWith({
      where: { pipelineId: 'pipeline-org-default', deletedAt: null, isActive: true },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    expect(dealCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pipelineId: 'pipeline-org-default',
          stageId: 'stage-first',
        }),
      }),
    );
  });

  it('falls back to the platform default pipeline when the org has none', async () => {
    const { service, pipelineFindFirst, pipelineStageFindFirst, dealCreate } = mockService();
    pipelineFindFirst.mockResolvedValueOnce(null);
    pipelineFindFirst.mockResolvedValueOnce({ id: PIPELINE_ID });
    pipelineStageFindFirst.mockResolvedValueOnce({ id: STAGE_ID, pipelineId: PIPELINE_ID });
    dealCreate.mockResolvedValue({ id: DEAL_ID, title: 'Acme', value: 500 });

    await service.create(ORG_ID, 'actor', { title: 'Acme' } as never);

    expect(pipelineFindFirst).toHaveBeenNthCalledWith(1, {
      where: { organizationId: ORG_ID, deletedAt: null, isActive: true, isDefault: true },
      select: { id: true },
    });
    expect(pipelineFindFirst).toHaveBeenNthCalledWith(2, {
      where: { organizationId: null, deletedAt: null, isActive: true, isDefault: true },
      select: { id: true },
    });
    expect(dealCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pipelineId: PIPELINE_ID, stageId: STAGE_ID }),
      }),
    );
  });

  it('leaves pipeline and stage null when no default pipeline is configured', async () => {
    const { service, pipelineFindFirst, dealCreate } = mockService();
    pipelineFindFirst.mockResolvedValueOnce(null);
    pipelineFindFirst.mockResolvedValueOnce(null);
    dealCreate.mockResolvedValue({ id: DEAL_ID, title: 'Acme', value: 500 });

    await service.create(ORG_ID, 'actor', { title: 'Acme' } as never);

    expect(dealCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pipelineId: null, stageId: null }),
      }),
    );
  });

  it('keeps stageId null when the default pipeline has no active stage', async () => {
    const { service, pipelineFindFirst, pipelineStageFindFirst, dealCreate } = mockService();
    pipelineFindFirst.mockResolvedValueOnce({ id: PIPELINE_ID });
    pipelineStageFindFirst.mockResolvedValueOnce(null);
    dealCreate.mockResolvedValue({ id: DEAL_ID, title: 'Acme', value: 500 });

    await service.create(ORG_ID, 'actor', { title: 'Acme' } as never);

    expect(pipelineStageFindFirst).toHaveBeenCalledWith({
      where: { pipelineId: PIPELINE_ID, deletedAt: null, isActive: true },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    expect(dealCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pipelineId: PIPELINE_ID, stageId: null }),
      }),
    );
  });

  it('preserves explicitly provided pipelineId/stageId without resolving defaults', async () => {
    const { service, pipelineFindFirst, pipelineStageFindFirst, dealCreate } = mockService();
    pipelineStageFindFirst.mockResolvedValue({ id: STAGE_ID, pipelineId: PIPELINE_ID });
    pipelineFindFirst.mockResolvedValue({ id: PIPELINE_ID });
    dealCreate.mockResolvedValue({ id: DEAL_ID, title: 'Acme', value: 500 });

    await service.create(ORG_ID, 'actor', {
      title: 'Acme',
      pipelineId: PIPELINE_ID,
      stageId: STAGE_ID,
    } as never);

    expect(pipelineFindFirst).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isDefault: true }) }),
    );
    expect(dealCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pipelineId: PIPELINE_ID, stageId: STAGE_ID }),
      }),
    );
  });

  it('does not touch existing pipeline/stage on update when neither field is sent', async () => {
    const { service, pipelineFindFirst, pipelineStageFindFirst, dealUpdate } = mockService();
    dealUpdate.mockResolvedValue({ id: DEAL_ID, title: 'Acme', value: 500 });

    await service.update(ORG_ID, 'actor', DEAL_ID, { title: 'Renamed' } as never);

    expect(pipelineFindFirst).not.toHaveBeenCalled();
    expect(pipelineStageFindFirst).not.toHaveBeenCalled();
    expect(dealUpdate).toHaveBeenCalledWith({
      where: { id: DEAL_ID, organizationId: ORG_ID, deletedAt: null },
      data: { title: 'Renamed' },
      select: expect.anything(),
    });
  });
});

describe('DealService.findAll', () => {
  it('scopes to org, excludes soft deleted, pages, and returns meta', async () => {
    const { service, dealCount, dealFindMany } = mockService();
    dealCount.mockResolvedValue(3);
    dealFindMany.mockResolvedValue([{ id: DEAL_ID, value: 100 }]);

    const result = await service.findAll(ORG_ID, {} as never);

    expect(dealCount).toHaveBeenCalledWith({ where: { organizationId: ORG_ID, deletedAt: null } });
    expect(dealFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG_ID, deletedAt: null },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(result.meta).toEqual({ total: 3, page: 1, limit: 10, totalPages: 1 });
  });

  it('applies search across title, notes, and contact company', async () => {
    const { service, dealCount, dealFindMany } = mockService();
    dealCount.mockResolvedValue(0);
    dealFindMany.mockResolvedValue([]);

    await service.findAll(ORG_ID, { search: '  acme  ' } as never);

    expect(dealFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { title: { contains: 'acme', mode: 'insensitive' } },
            { notes: { contains: 'acme', mode: 'insensitive' } },
            { contact: { company: { contains: 'acme', mode: 'insensitive' } } },
          ],
        }),
      }),
    );
  });

  it('applies stage, pipeline, and owner filters plus sorting/pagination', async () => {
    const { service, dealCount, dealFindMany } = mockService();
    dealCount.mockResolvedValue(25);
    dealFindMany.mockResolvedValue([]);

    await service.findAll(ORG_ID, {
      page: 3,
      limit: 10,
      stageId: STAGE_ID,
      pipelineId: PIPELINE_ID,
      ownerId: OWNER_ID,
      sortBy: 'value',
      sortOrder: 'asc',
    } as never);

    expect(dealFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          stageId: STAGE_ID,
          pipelineId: PIPELINE_ID,
          ownerId: OWNER_ID,
        }),
        skip: 20,
        take: 10,
        orderBy: { value: 'asc' },
      }),
    );
  });

  it('clamps unknown sort field to createdAt desc', async () => {
    const { service, dealCount, dealFindMany } = mockService();
    dealCount.mockResolvedValue(0);
    dealFindMany.mockResolvedValue([]);

    await service.findAll(ORG_ID, { sortBy: 'notAField', sortOrder: 'desc' } as never);

    expect(dealFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
  });
});

describe('DealService.findById', () => {
  it('returns a deal that belongs to the org and converts value', async () => {
    const { service, dealFindFirst } = mockService();
    dealFindFirst.mockResolvedValue({ id: DEAL_ID, value: 500 });

    const result = await service.findById(ORG_ID, DEAL_ID);

    expect(dealFindFirst).toHaveBeenCalledWith({
      where: { id: DEAL_ID, organizationId: ORG_ID, deletedAt: null },
      select: expect.anything(),
    });
    expect(result.value).toBe(500);
  });

  it('throws NotFound for cross-tenant or deleted deal', async () => {
    const { service, dealFindFirst } = mockService();
    dealFindFirst.mockResolvedValue(null);

    await expect(service.findById(ORG_ID, 'deal-other')).rejects.toThrow(NotFoundException);
  });
});

describe('DealService.update', () => {
  it('normalizes fields and converts value on update', async () => {
    const { service, dealUpdate } = mockService();
    dealUpdate.mockResolvedValue({ id: DEAL_ID, title: 'Acme', value: 900, notes: 'yo' });

    await service.update(ORG_ID, 'actor', DEAL_ID, {
      title: ' Acme ',
      value: 900,
      notes: ' yo ',
    } as never);

    expect(dealUpdate).toHaveBeenCalledWith({
      where: { id: DEAL_ID, organizationId: ORG_ID, deletedAt: null },
      data: expect.objectContaining({ title: 'Acme', notes: 'yo' }),
      select: expect.anything(),
    });
  });

  it('maps P2025 to NotFound', async () => {
    const { service, dealUpdate } = mockService();
    dealUpdate.mockRejectedValue(prismaKnownError('P2025'));

    await expect(service.update(ORG_ID, 'actor', DEAL_ID, { title: 'x' } as never)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects connecting a cross-tenant contact', async () => {
    const { service, contactFindFirst, dealUpdate } = mockService();
    contactFindFirst.mockResolvedValue(null);

    await expect(
      service.update(ORG_ID, 'actor', DEAL_ID, { contactId: CONTACT_ID } as never),
    ).rejects.toThrow(BadRequestException);
    expect(dealUpdate).not.toHaveBeenCalled();
  });

  it('allows disconnecting relations with null', async () => {
    const { service, dealUpdate } = mockService();
    dealUpdate.mockResolvedValue({ id: DEAL_ID });

    await service.update(ORG_ID, 'actor', DEAL_ID, { contactId: null, leadId: null } as never);

    expect(dealUpdate).toHaveBeenCalledWith({
      where: { id: DEAL_ID, organizationId: ORG_ID, deletedAt: null },
      data: expect.objectContaining({
        contact: { disconnect: true },
        lead: { disconnect: true },
      }),
      select: expect.anything(),
    });
  });

  it('update with pipelineId and a matching stageId connects both consistently', async () => {
    const { service, pipelineFindFirst, pipelineStageFindFirst, dealUpdate } = mockService();
    pipelineFindFirst.mockResolvedValue({ id: PIPELINE_ID });
    pipelineStageFindFirst.mockResolvedValue({ id: STAGE_ID, pipelineId: PIPELINE_ID, isActive: true });
    dealUpdate.mockResolvedValue({ id: DEAL_ID });

    await service.update(ORG_ID, 'actor', DEAL_ID, {
      pipelineId: PIPELINE_ID,
      stageId: STAGE_ID,
    } as never);

    expect(dealUpdate).toHaveBeenCalledWith({
      where: { id: DEAL_ID, organizationId: ORG_ID, deletedAt: null },
      data: expect.objectContaining({
        pipeline: { connect: { id: PIPELINE_ID } },
        stage: { connect: { id: STAGE_ID } },
      }),
      select: expect.anything(),
    });
  });

  it('update rejects a stage that does not belong to the selected pipeline and does not mutate', async () => {
    const { service, pipelineFindFirst, pipelineStageFindFirst, dealUpdate } = mockService();
    pipelineFindFirst.mockResolvedValue({ id: PIPELINE_ID });
    pipelineStageFindFirst.mockResolvedValue({ id: STAGE_ID, pipelineId: 'pipeline-other', isActive: true });

    await expect(
      service.update(ORG_ID, 'actor', DEAL_ID, {
        pipelineId: PIPELINE_ID,
        stageId: STAGE_ID,
      } as never),
    ).rejects.toThrow(BadRequestException);
    expect(dealUpdate).not.toHaveBeenCalled();
  });

  it('update rejects a deal from another organization on a pipeline-only change', async () => {
    const { service, pipelineFindFirst, dealFindFirst, dealUpdate } = mockService();
    pipelineFindFirst.mockResolvedValue({ id: 'pipeline-new' });
    dealFindFirst.mockResolvedValue(null);

    await expect(
      service.update(ORG_ID, 'actor', 'deal-other', { pipelineId: 'pipeline-new' } as never),
    ).rejects.toThrow(NotFoundException);
    expect(dealUpdate).not.toHaveBeenCalled();
  });
});

describe('DealService.softDelete', () => {
  it('soft deletes a deal that belongs to the org', async () => {
    const { service, dealFindFirst, dealUpdate } = mockService();

    await service.softDelete(ORG_ID, 'actor', DEAL_ID);

    expect(dealFindFirst).toHaveBeenCalledWith({
      where: { id: DEAL_ID, organizationId: ORG_ID, deletedAt: null },
      select: { id: true },
    });
    expect(dealUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DEAL_ID, organizationId: ORG_ID, deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      }),
    );
  });

  it('throws NotFound for a cross-tenant deal', async () => {
    const { service, dealFindFirst, dealUpdate } = mockService();
    dealFindFirst.mockResolvedValue(null);

    await expect(service.softDelete(ORG_ID, 'actor', 'deal-other')).rejects.toThrow(NotFoundException);
    expect(dealUpdate).not.toHaveBeenCalled();
  });

  it('throws NotFound for an already-soft-deleted deal (repeated delete)', async () => {
    const { service, dealFindFirst, dealUpdate } = mockService();
    dealFindFirst.mockResolvedValue(null);

    await expect(service.softDelete(ORG_ID, 'actor', DEAL_ID)).rejects.toThrow(NotFoundException);
    expect(dealUpdate).not.toHaveBeenCalled();
  });
});

describe('DealService pipeline/stage consistency', () => {
  it('create with only stageId resolves the pipeline from the stage', async () => {
    const { service, pipelineStageFindFirst, pipelineFindFirst, dealCreate } = mockService();
    pipelineStageFindFirst.mockResolvedValue({ id: STAGE_ID, pipelineId: PIPELINE_ID, isActive: true });
    pipelineFindFirst.mockResolvedValue({ id: PIPELINE_ID });
    dealCreate.mockResolvedValue({ id: DEAL_ID });

    await service.create(ORG_ID, 'actor', { title: 'Acme', stageId: STAGE_ID } as never);

    expect(dealCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pipelineId: PIPELINE_ID, stageId: STAGE_ID }),
      }),
    );
  });

  it('update with only stageId aligns the deal pipeline to the stage pipeline', async () => {
    const { service, pipelineStageFindFirst, pipelineFindFirst, dealUpdate } = mockService();
    pipelineStageFindFirst.mockResolvedValue({ id: STAGE_ID, pipelineId: PIPELINE_ID, isActive: true });
    pipelineFindFirst.mockResolvedValue({ id: PIPELINE_ID });
    dealUpdate.mockResolvedValue({ id: DEAL_ID, title: 'Acme', value: 100 });

    await service.update(ORG_ID, 'actor', DEAL_ID, { stageId: STAGE_ID } as never);

    expect(dealUpdate).toHaveBeenCalledWith({
      where: { id: DEAL_ID, organizationId: ORG_ID, deletedAt: null },
      data: expect.objectContaining({
        pipeline: { connect: { id: PIPELINE_ID } },
        stage: { connect: { id: STAGE_ID } },
      }),
      select: expect.anything(),
    });
  });

  it('update pipeline-only disconnects a stale stage that belongs to another pipeline', async () => {
    const { service, pipelineFindFirst, dealFindFirst, dealUpdate } = mockService();
    pipelineFindFirst.mockResolvedValue({ id: 'pipeline-new' });
    dealFindFirst.mockResolvedValue({
      id: DEAL_ID,
      organizationId: ORG_ID,
      pipelineId: PIPELINE_ID,
      stageId: 'stage-old',
    });
    dealUpdate.mockResolvedValue({ id: DEAL_ID });

    await service.update(ORG_ID, 'actor', DEAL_ID, { pipelineId: 'pipeline-new' } as never);

    expect(dealUpdate).toHaveBeenCalledWith({
      where: { id: DEAL_ID, organizationId: ORG_ID, deletedAt: null },
      data: expect.objectContaining({
        pipeline: { connect: { id: 'pipeline-new' } },
        stage: { disconnect: true },
      }),
      select: expect.anything(),
    });
  });

  it('update pipeline-only keeps the existing stage when it already belongs to the new pipeline', async () => {
    const { service, pipelineFindFirst, dealFindFirst, dealUpdate } = mockService();
    pipelineFindFirst.mockResolvedValue({ id: PIPELINE_ID });
    dealFindFirst.mockResolvedValue({
      id: DEAL_ID,
      organizationId: ORG_ID,
      pipelineId: PIPELINE_ID,
      stageId: STAGE_ID,
    });
    dealUpdate.mockResolvedValue({ id: DEAL_ID });

    await service.update(ORG_ID, 'actor', DEAL_ID, { pipelineId: PIPELINE_ID } as never);

    expect(dealUpdate).toHaveBeenCalledWith({
      where: { id: DEAL_ID, organizationId: ORG_ID, deletedAt: null },
      data: expect.objectContaining({
        pipeline: { connect: { id: PIPELINE_ID } },
      }),
      select: expect.anything(),
    });
    const data = dealUpdate.mock.calls[0][0] as { data: { stage?: unknown } };
    expect(data.data.stage).toBeUndefined();
  });
});