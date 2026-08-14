import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type { CreatePipelineStageDto } from './dto/create-pipeline-stage.dto';
import type { UpdatePipelineStageDto } from './dto/update-pipeline-stage.dto';

const STAGE_SELECT = {
  id: true,
  pipelineId: true,
  name: true,
  position: true,
  isWon: true,
  isLost: true,
  isActive: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class PipelineStageService {
  private readonly logger = new Logger(PipelineStageService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByPipeline(orgId: string, pipelineId: string) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: {
        id: pipelineId,
        deletedAt: null,
        OR: [{ organizationId: orgId }, { organizationId: null }],
      },
      select: { id: true },
    });

    if (!pipeline) throw new NotFoundException('Pipeline not found');

    return this.prisma.pipelineStage.findMany({
      where: { pipelineId, deletedAt: null },
      select: STAGE_SELECT,
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findById(orgId: string, stageId: string) {
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id: stageId, deletedAt: null },
      select: { ...STAGE_SELECT, pipeline: { select: { organizationId: true, deletedAt: true } } },
    });

    if (!stage || stage.pipeline.deletedAt) throw new NotFoundException('Stage not found');

    const orgScoped =
      stage.pipeline.organizationId === orgId || stage.pipeline.organizationId === null;

    if (!orgScoped) throw new NotFoundException('Stage not found');

    return {
      id: stage.id,
      pipelineId: stage.pipelineId,
      name: stage.name,
      position: stage.position,
      isWon: stage.isWon,
      isLost: stage.isLost,
      isActive: stage.isActive,
      createdAt: stage.createdAt,
      updatedAt: stage.updatedAt,
    };
  }

  async create(orgId: string, userId: string, pipelineId: string, dto: CreatePipelineStageDto) {
    await this.assertEditablePipeline(orgId, pipelineId);
    this.assertWonLost(dto.isWon, dto.isLost);

    const stage = await this.prisma.pipelineStage
      .create({
        data: {
          name: dto.name.trim(),
          position: dto.position ?? 0,
          isWon: dto.isWon ?? false,
          isLost: dto.isLost ?? false,
          isActive: dto.isActive ?? true,
          pipeline: { connect: { id: pipelineId } },
        },
        select: STAGE_SELECT,
      })
      .catch((err: unknown) => {
        if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
          throw new ConflictException('A stage with this name already exists in this pipeline');
        }
        throw err;
      });

    this.logger.log(`Pipeline stage created: ${stage.id} by ${userId}`);
    return stage;
  }

  async update(orgId: string, userId: string, stageId: string, dto: UpdatePipelineStageDto) {
    const existing = await this.prisma.pipelineStage.findFirst({
      where: { id: stageId, deletedAt: null },
      select: {
        id: true,
        pipeline: { select: { id: true, organizationId: true, deletedAt: true } },
      },
    });

    if (!existing || existing.pipeline.deletedAt) {
      throw new NotFoundException('Stage not found');
    }

    if (existing.pipeline.organizationId !== orgId) {
      if (existing.pipeline.organizationId === null) {
        throw new ForbiddenException('The platform default pipeline stages cannot be modified');
      }
      throw new NotFoundException('Stage not found');
    }

    this.assertWonLost(dto.isWon, dto.isLost);

    const updateData: Prisma.PipelineStageUpdateInput = {};
    if (dto.name !== undefined) updateData.name = dto.name.trim();
    if (dto.position !== undefined) updateData.position = dto.position;
    if (dto.isWon !== undefined) updateData.isWon = dto.isWon;
    if (dto.isLost !== undefined) updateData.isLost = dto.isLost;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const updated = await this.prisma.pipelineStage
      .update({
        where: { id: stageId, deletedAt: null },
        data: updateData,
        select: STAGE_SELECT,
      })
      .catch((err: unknown) => {
        if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2025') {
          throw new NotFoundException('Stage not found');
        }
        if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
          throw new ConflictException('A stage with this name already exists in this pipeline');
        }
        throw err;
      });

    this.logger.log(`Pipeline stage updated: ${stageId} by ${userId}`);
    return updated;
  }

  async softDelete(orgId: string, userId: string, stageId: string) {
    const existing = await this.prisma.pipelineStage.findFirst({
      where: { id: stageId, deletedAt: null },
      select: {
        id: true,
        pipeline: { select: { organizationId: true, deletedAt: true } },
      },
    });

    if (!existing || existing.pipeline.deletedAt) {
      throw new NotFoundException('Stage not found');
    }

    if (existing.pipeline.organizationId !== orgId) {
      if (existing.pipeline.organizationId === null) {
        throw new ForbiddenException('The platform default pipeline stages cannot be deleted');
      }
      throw new NotFoundException('Stage not found');
    }

    await this.prisma.pipelineStage
      .update({
        where: { id: stageId, deletedAt: null },
        data: { deletedAt: new Date() },
      })
      .catch((err: unknown) => {
        if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2025') {
          throw new NotFoundException('Stage not found');
        }
        throw err;
      });

    this.logger.log(`Pipeline stage soft-deleted: ${stageId} by ${userId}`);
    return { message: 'Stage deleted successfully' };
  }

  /** Ensures the pipeline belongs to the org and is active for stage management. */
  private async assertEditablePipeline(orgId: string, pipelineId: string): Promise<void> {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id: pipelineId, organizationId: orgId, deletedAt: null },
      select: { id: true, isActive: true },
    });

    if (!pipeline) {
      const platform = await this.prisma.pipeline.findFirst({
        where: { id: pipelineId, organizationId: null },
        select: { id: true },
      });
      if (platform) {
        throw new ForbiddenException('The platform default pipeline cannot be modified');
      }
      throw new NotFoundException('Pipeline not found');
    }

    if (!pipeline.isActive) {
      throw new BadRequestException('Cannot add stages to an inactive pipeline');
    }
  }

  private assertWonLost(isWon?: boolean, isLost?: boolean): void {
    if (isWon && isLost) {
      throw new BadRequestException('A stage cannot be both won and lost');
    }
  }
}
