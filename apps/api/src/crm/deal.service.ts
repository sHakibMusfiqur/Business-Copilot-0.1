import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type { CreateDealDto } from './dto/create-deal.dto';
import type { UpdateDealDto } from './dto/update-deal.dto';
import type { QueryDealsDto } from './dto/query-deals.dto';

const CONTACT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  company: true,
} as const;

const LEAD_SELECT = {
  id: true,
  leadNumber: true,
  name: true,
  status: true,
} as const;

const OWNER_SELECT = {
  id: true,
  name: true,
  email: true,
} as const;

@Injectable()
export class DealService {
  private readonly logger = new Logger(DealService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string, query: QueryDealsDto) {
    const {
      page = 1,
      limit = 10,
      search,
      stageId,
      pipelineId,
      ownerId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.DealWhereInput = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (search) {
      const sanitized = search.trim();
      where.OR = [
        { title: { contains: sanitized, mode: 'insensitive' } },
        { notes: { contains: sanitized, mode: 'insensitive' } },
        { contact: { company: { contains: sanitized, mode: 'insensitive' } } },
      ];
    }

    if (stageId) where.stageId = stageId;
    if (pipelineId) where.pipelineId = pipelineId;
    if (ownerId) where.ownerId = ownerId;

    const allowedSortFields = ['title', 'value', 'expectedCloseDate', 'createdAt', 'updatedAt'];
    const field = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    const [total, deals] = await Promise.all([
      this.prisma.deal.count({ where }),
      this.prisma.deal.findMany({
        where,
        select: {
          id: true,
          title: true,
          value: true,
          pipelineId: true,
          stageId: true,
          expectedCloseDate: true,
          ownerId: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          stage: { select: { id: true, name: true, position: true, isWon: true, isLost: true } },
          contact: { select: CONTACT_SELECT },
          lead: { select: LEAD_SELECT },
          owner: { select: OWNER_SELECT },
        },
        orderBy: { [field]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const data = deals.map((d) => ({
      ...d,
      value: Number(d.value),
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(orgId: string, dealId: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, organizationId: orgId, deletedAt: null },
      select: {
        id: true,
        title: true,
        value: true,
        pipelineId: true,
        stageId: true,
        contactId: true,
        leadId: true,
        ownerId: true,
        expectedCloseDate: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        pipeline: { select: { id: true, name: true, isDefault: true } },
        stage: { select: { id: true, name: true, position: true, isWon: true, isLost: true } },
        contact: { select: CONTACT_SELECT },
        lead: { select: LEAD_SELECT },
        owner: { select: OWNER_SELECT },
      },
    });

    if (!deal) throw new NotFoundException('Deal not found');
    return { ...deal, value: Number(deal.value) };
  }

  async create(orgId: string, userId: string, dto: CreateDealDto) {
    let pipelineId = dto.pipelineId ?? null;
    let stageId = dto.stageId ?? null;

    if (dto.pipelineId || dto.stageId) {
      const resolvedPipelineId = await this.assertPipelineAndStageAccessible(orgId, dto.pipelineId, dto.stageId);
      if (resolvedPipelineId) pipelineId = resolvedPipelineId;
    } else {
      const resolved = await this.resolveDefaultPipelineAndStage(orgId);
      pipelineId = resolved.pipelineId;
      stageId = resolved.stageId;
    }
    if (dto.contactId) await this.assertContactAccessible(orgId, dto.contactId);
    if (dto.leadId) await this.assertLeadAccessible(orgId, dto.leadId);
    if (dto.ownerId) await this.assertOwnerAccessible(orgId, dto.ownerId);

    const deal = await this.prisma.deal.create({
      data: {
        organizationId: orgId,
        title: dto.title.trim(),
        value: new Prisma.Decimal(dto.value ?? 0),
        pipelineId,
        stageId,
        contactId: dto.contactId ?? null,
        leadId: dto.leadId ?? null,
        ownerId: dto.ownerId ?? null,
        expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : null,
        notes: dto.notes ? dto.notes.trim() : null,
      },
      select: {
        id: true,
        title: true,
        value: true,
        pipelineId: true,
        stageId: true,
        contactId: true,
        leadId: true,
        ownerId: true,
        expectedCloseDate: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(`Deal created: ${deal.id} by ${userId}`);
    return { ...deal, value: Number(deal.value) };
  }

  async update(orgId: string, userId: string, dealId: string, dto: UpdateDealDto) {
    let effectivePipelineId: string | null | undefined = dto.pipelineId;
    if (dto.pipelineId || dto.stageId) {
      const resolvedPipelineId = await this.assertPipelineAndStageAccessible(orgId, dto.pipelineId, dto.stageId);
      if (dto.stageId && dto.pipelineId === undefined && resolvedPipelineId) {
        effectivePipelineId = resolvedPipelineId;
      }
    }
    if (dto.contactId) await this.assertContactAccessible(orgId, dto.contactId);
    if (dto.leadId) await this.assertLeadAccessible(orgId, dto.leadId);
    if (dto.ownerId) await this.assertOwnerAccessible(orgId, dto.ownerId);

    const updateData: Prisma.DealUpdateInput = {};
    if (dto.title !== undefined) updateData.title = dto.title.trim();
    if (dto.value !== undefined) updateData.value = new Prisma.Decimal(dto.value);
    if (effectivePipelineId !== undefined) {
      updateData.pipeline = effectivePipelineId ? { connect: { id: effectivePipelineId } } : { disconnect: true };
    }
    if (dto.stageId !== undefined) {
      updateData.stage = dto.stageId ? { connect: { id: dto.stageId } } : { disconnect: true };
    }
    if (dto.pipelineId !== undefined && dto.stageId === undefined) {
      const existing = await this.prisma.deal.findFirst({
        where: { id: dealId, organizationId: orgId, deletedAt: null },
        select: { id: true, stageId: true, pipelineId: true },
      });
      if (!existing) throw new NotFoundException('Deal not found');
      if (existing.stageId && existing.pipelineId !== dto.pipelineId) {
        updateData.stage = { disconnect: true };
      }
    }
    if (dto.contactId !== undefined) {
      updateData.contact = dto.contactId ? { connect: { id: dto.contactId } } : { disconnect: true };
    }
    if (dto.leadId !== undefined) {
      updateData.lead = dto.leadId ? { connect: { id: dto.leadId } } : { disconnect: true };
    }
    if (dto.ownerId !== undefined) {
      updateData.owner = dto.ownerId ? { connect: { id: dto.ownerId } } : { disconnect: true };
    }
    if (dto.expectedCloseDate !== undefined) {
      updateData.expectedCloseDate = dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : null;
    }
    if (dto.notes !== undefined) updateData.notes = dto.notes.trim();

    const updated = await this.prisma.deal
      .update({
        where: { id: dealId, organizationId: orgId, deletedAt: null },
        data: updateData,
        select: {
          id: true,
          title: true,
          value: true,
          pipelineId: true,
          stageId: true,
          contactId: true,
          leadId: true,
          ownerId: true,
          expectedCloseDate: true,
          notes: true,
          updatedAt: true,
        },
      })
      .catch((err: unknown) => {
        if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2025') {
          throw new NotFoundException('Deal not found');
        }
        throw err;
      });

    this.logger.log(`Deal updated: ${dealId} by ${userId}`);
    return { ...updated, value: Number(updated.value) };
  }

  async softDelete(orgId: string, userId: string, dealId: string) {
    const existing = await this.prisma.deal.findFirst({
      where: { id: dealId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });

    if (!existing) throw new NotFoundException('Deal not found');

    await this.prisma.deal
      .update({
        where: { id: dealId, organizationId: orgId, deletedAt: null },
        data: { deletedAt: new Date() },
      })
      .catch((err: unknown) => {
        if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2025') {
          throw new NotFoundException('Deal not found');
        }
        throw err;
      });

    this.logger.log(`Deal deleted: ${dealId} by ${userId}`);
    return { message: 'Deal deleted successfully' };
  }

  /**
   * Ensures the referenced pipeline/stage is either the org-scoped pipeline
   * or the platform default pipeline (organizationId null). When both are
   * supplied, the stage must belong to the given pipeline. Returns the
   * pipeline the stage belongs to (when a stage is supplied) or the given
   * pipeline, so the caller can keep the deal's pipeline/stage consistent.
   */
  private async assertPipelineAndStageAccessible(
    orgId: string,
    pipelineId?: string,
    stageId?: string,
  ): Promise<string | null> {
    let resolvedPipelineId: string | null = pipelineId ?? null;

    if (pipelineId) {
      await this.assertPipelineAccessible(orgId, pipelineId);
    }

    if (stageId) {
      const stage = await this.prisma.pipelineStage.findFirst({
        where: { id: stageId, deletedAt: null, isActive: true },
        select: { id: true, pipelineId: true },
      });

      if (!stage) {
        throw new BadRequestException('Stage not found or not active');
      }

      if (pipelineId && stage.pipelineId !== pipelineId) {
        throw new BadRequestException('Stage does not belong to the selected pipeline');
      }

      await this.assertPipelineAccessible(orgId, stage.pipelineId);
      resolvedPipelineId = stage.pipelineId;
    }

    return resolvedPipelineId;
  }

  /**
   * Resolves the default pipeline/stage for a new deal. Prefers the active
   * org-scoped default pipeline, falling back to the active platform default
   * (organizationId null). When a default pipeline exists, assigns its first
   * active stage. Returns null pipeline/stage when no default is configured.
   */
  private async resolveDefaultPipelineAndStage(
    orgId: string,
  ): Promise<{ pipelineId: string | null; stageId: string | null }> {
    const findDefault = (organizationId: string | null) =>
      this.prisma.pipeline.findFirst({
        where: { organizationId, deletedAt: null, isActive: true, isDefault: true },
        select: { id: true },
      });

    const pipeline = (await findDefault(orgId)) ?? (await findDefault(null));

    if (!pipeline) return { pipelineId: null, stageId: null };

    const stage = await this.prisma.pipelineStage.findFirst({
      where: { pipelineId: pipeline.id, deletedAt: null, isActive: true },
      orderBy: { position: 'asc' },
      select: { id: true },
    });

    return { pipelineId: pipeline.id, stageId: stage?.id ?? null };
  }

  private async assertPipelineAccessible(orgId: string, pipelineId: string): Promise<void> {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: {
        id: pipelineId,
        deletedAt: null,
        isActive: true,
        OR: [{ organizationId: orgId }, { organizationId: null }],
      },
      select: { id: true },
    });

    if (!pipeline) {
      throw new BadRequestException('Pipeline not found or not accessible to this organization');
    }
  }

  private async assertContactAccessible(orgId: string, contactId: string): Promise<void> {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });

    if (!contact) {
      throw new BadRequestException('Contact not found or not accessible to this organization');
    }
  }

  private async assertLeadAccessible(orgId: string, leadId: string): Promise<void> {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });

    if (!lead) {
      throw new BadRequestException('Lead not found or not accessible to this organization');
    }
  }

  private async assertOwnerAccessible(orgId: string, ownerId: string): Promise<void> {
    const owner = await this.prisma.user.findFirst({
      where: { id: ownerId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });

    if (!owner) {
      throw new BadRequestException('Owner not found or not accessible to this organization');
    }
  }
}
