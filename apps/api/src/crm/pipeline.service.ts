import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type { CreatePipelineDto } from './dto/create-pipeline.dto';
import type { UpdatePipelineDto } from './dto/update-pipeline.dto';
import type { QueryPipelinesDto } from './dto/query-pipelines.dto';

const PIPELINE_SELECT = {
  id: true,
  name: true,
  description: true,
  organizationId: true,
  isDefault: true,
  isActive: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string, query: QueryPipelinesDto) {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.PipelineWhereInput = {
      deletedAt: null,
      OR: [{ organizationId: orgId }, { organizationId: null }],
    };

    if (search) {
      const sanitized = search.trim();
      where.AND = {
        OR: [
          { name: { contains: sanitized, mode: 'insensitive' } },
          { description: { contains: sanitized, mode: 'insensitive' } },
        ],
      };
    }

    const allowedSortFields = ['name', 'createdAt', 'updatedAt'];
    const field = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    const [total, pipelines] = await Promise.all([
      this.prisma.pipeline.count({ where }),
      this.prisma.pipeline.findMany({
        where,
        select: PIPELINE_SELECT,
        orderBy: { [field]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: pipelines,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(orgId: string, pipelineId: string) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: {
        id: pipelineId,
        deletedAt: null,
        OR: [{ organizationId: orgId }, { organizationId: null }],
      },
      select: PIPELINE_SELECT,
    });

    if (!pipeline) throw new NotFoundException('Pipeline not found');
    return pipeline;
  }

  async create(orgId: string, userId: string, dto: CreatePipelineDto) {
    if (dto.isDefault && dto.isActive === false) {
      throw new BadRequestException('A default pipeline must be active');
    }

    if (dto.isDefault) {
      await this.prisma.pipeline.updateMany({
        where: { organizationId: orgId, deletedAt: null, isDefault: true },
        data: { isDefault: false },
      });
    }

    const pipeline = await this.prisma.pipeline.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        organizationId: orgId,
        isDefault: dto.isDefault ?? false,
        isActive: dto.isActive ?? true,
      },
      select: PIPELINE_SELECT,
    });

    this.logger.log(`Pipeline created: ${pipeline.id} by ${userId}`);
    return pipeline;
  }

  async update(orgId: string, userId: string, pipelineId: string, dto: UpdatePipelineDto) {
    const existing = await this.prisma.pipeline.findFirst({
      where: { id: pipelineId, organizationId: orgId, deletedAt: null },
      select: { id: true, isActive: true, isDefault: true },
    });

    if (!existing) {
      await this.assertNotPlatformDefault(pipelineId);
      throw new NotFoundException('Pipeline not found');
    }

    if (dto.isDefault === true && dto.isActive === false) {
      throw new BadRequestException('A default pipeline must be active');
    }
    if (dto.isDefault === true && dto.isActive === undefined && existing.isActive === false) {
      throw new BadRequestException('A default pipeline must be active');
    }
    if (dto.isActive === false && existing.isDefault && dto.isDefault !== false) {
      throw new BadRequestException('The default pipeline cannot be deactivated');
    }

    if (dto.isDefault === true) {
      await this.prisma.pipeline.updateMany({
        where: { organizationId: orgId, deletedAt: null, isDefault: true, id: { not: pipelineId } },
        data: { isDefault: false },
      });
    }

    const updateData: Prisma.PipelineUpdateInput = {};
    if (dto.name !== undefined) updateData.name = dto.name.trim();
    if (dto.description !== undefined) updateData.description = dto.description.trim();
    if (dto.isDefault !== undefined) updateData.isDefault = dto.isDefault;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const updated = await this.prisma.pipeline
      .update({
        where: { id: pipelineId, organizationId: orgId, deletedAt: null },
        data: updateData,
        select: PIPELINE_SELECT,
      })
      .catch((err: unknown) => {
        if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2025') {
          throw new NotFoundException('Pipeline not found');
        }
        throw err;
      });

    this.logger.log(`Pipeline updated: ${pipelineId} by ${userId}`);
    return updated;
  }

  async softDelete(orgId: string, userId: string, pipelineId: string) {
    const existing = await this.prisma.pipeline.findFirst({
      where: { id: pipelineId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });

    if (!existing) {
      await this.assertNotPlatformDefault(pipelineId);
      throw new NotFoundException('Pipeline not found');
    }

    await this.prisma.pipeline
      .update({
        where: { id: pipelineId, organizationId: orgId, deletedAt: null },
        data: { deletedAt: new Date() },
      })
      .catch((err: unknown) => {
        if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2025') {
          throw new NotFoundException('Pipeline not found');
        }
        throw err;
      });

    this.logger.log(`Pipeline soft-deleted: ${pipelineId} by ${userId}`);
    return { message: 'Pipeline deleted successfully' };
  }

  /** Throws Forbidden when the target is the shared platform-default pipeline. */
  private async assertNotPlatformDefault(pipelineId: string): Promise<void> {
    const platform = await this.prisma.pipeline.findFirst({
      where: { id: pipelineId, organizationId: null },
      select: { id: true },
    });

    if (platform) {
      throw new ForbiddenException('The platform default pipeline cannot be modified');
    }
  }
}
