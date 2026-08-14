import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { LeadService } from './lead.service';

import type { CreateActivityDto } from './dto/create-activity.dto';
import type { UpdateActivityDto } from './dto/update-activity.dto';
import type { QueryActivityDto } from './dto/query-activity.dto';

const ACTIVITY_DETAIL_SELECT = {
  id: true,
  type: true,
  title: true,
  description: true,
  dueDate: true,
  completed: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true } },
} as const;

const ACTIVITY_SUMMARY_SELECT = {
  id: true,
  type: true,
  title: true,
  description: true,
  dueDate: true,
  completed: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leadService: LeadService,
  ) {}

  async findAll(orgId: string, query: QueryActivityDto) {
    const { page = 1, limit = 20, completed } = query;

    const where: Prisma.ActivityWhereInput = {
      deletedAt: null,
      lead: { organizationId: orgId, deletedAt: null },
    };
    if (completed !== undefined) where.completed = completed;

    const [total, activities] = await Promise.all([
      this.prisma.activity.count({ where }),
      this.prisma.activity.findMany({
        where,
        select: ACTIVITY_SUMMARY_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: activities,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(orgId: string, activityId: string) {
    const activity = await this.prisma.activity.findFirst({
      where: { id: activityId, deletedAt: null, lead: { organizationId: orgId, deletedAt: null } },
      select: ACTIVITY_DETAIL_SELECT,
    });

    if (!activity) throw new NotFoundException('Activity not found');

    return activity;
  }

  async findByLead(orgId: string, leadId: string, query: QueryActivityDto) {
    const { page = 1, limit = 20, completed } = query;

    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId: orgId, deletedAt: null },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    const where: Prisma.ActivityWhereInput = { leadId, deletedAt: null };
    if (completed !== undefined) where.completed = completed;

    const [total, activities] = await Promise.all([
      this.prisma.activity.count({ where }),
      this.prisma.activity.findMany({
        where,
        select: ACTIVITY_DETAIL_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: activities,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(orgId: string, userId: string, leadId: string, dto: CreateActivityDto) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId: orgId, deletedAt: null },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    const activity = await this.prisma.activity.create({
      data: {
        leadId,
        type: dto.type,
        title: dto.title,
        description: dto.description ?? null,
        dueDate: dto.dueDate ?? null,
        completed: dto.completed ?? false,
        createdById: userId,
      },
      select: ACTIVITY_SUMMARY_SELECT,
    });

    const typeLabel = dto.type.charAt(0) + dto.type.slice(1).toLowerCase();
    await this.leadService.createTimelineEvent(
      orgId, leadId, userId, 'ACTIVITY_ADDED',
      `${typeLabel} added: ${dto.title}`,
    );

    this.logger.log(`Activity created: ${activity.id} for lead ${leadId}`);
    return activity;
  }

  async update(orgId: string, userId: string, activityId: string, dto: UpdateActivityDto) {
    const scopedWhere: Prisma.ActivityWhereInput = {
      id: activityId,
      deletedAt: null,
      lead: { organizationId: orgId, deletedAt: null },
    };

    const updateData: Prisma.ActivityUpdateInput = {};
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.title !== undefined) updateData.title = dto.title.trim();
    if (dto.description !== undefined) updateData.description = dto.description.trim();
    if (dto.dueDate !== undefined) updateData.dueDate = dto.dueDate;
    if (dto.completed !== undefined) updateData.completed = dto.completed;

    if (Object.keys(updateData).length === 0) {
      const current = await this.prisma.activity.findFirst({
        where: scopedWhere,
        select: { ...ACTIVITY_DETAIL_SELECT, leadId: true },
      });
      if (!current) throw new NotFoundException('Activity not found');
      return current;
    }

    const result = await this.prisma.activity.updateMany({
      where: scopedWhere,
      data: updateData,
    });

    if (result.count === 0) throw new NotFoundException('Activity not found');

    const updated = await this.prisma.activity.findFirst({
      where: scopedWhere,
      select: { ...ACTIVITY_DETAIL_SELECT, leadId: true },
    });
    if (!updated) throw new NotFoundException('Activity not found');

    await this.leadService.createTimelineEvent(
      orgId, updated.leadId, userId, 'ACTIVITY_UPDATED',
      `Activity updated: ${updated.title}`,
    );

    this.logger.log(`Activity updated: ${activityId} by ${userId}`);
    return updated;
  }

  async toggleComplete(orgId: string, userId: string, activityId: string) {
    const activity = await this.prisma.activity.findFirst({
      where: { id: activityId, deletedAt: null, lead: { organizationId: orgId, deletedAt: null } },
      select: { id: true, completed: true, leadId: true, title: true },
    });

    if (!activity) throw new NotFoundException('Activity not found');

    const result = await this.prisma.activity.updateMany({
      where: { id: activityId, deletedAt: null, lead: { organizationId: orgId, deletedAt: null } },
      data: { completed: !activity.completed },
    });

    if (result.count === 0) throw new NotFoundException('Activity not found');

    const updated = { id: activityId, completed: !activity.completed };

    await this.leadService.createTimelineEvent(
      orgId, activity.leadId, userId, 'ACTIVITY_UPDATED',
      `Activity ${updated.completed ? 'completed' : 'reopened'}: ${activity.title}`,
    );

    return updated;
  }

  async delete(orgId: string, userId: string, activityId: string) {
    const activity = await this.prisma.activity.findFirst({
      where: { id: activityId, deletedAt: null, lead: { organizationId: orgId, deletedAt: null } },
      select: { id: true, leadId: true, title: true },
    });

    if (!activity) throw new NotFoundException('Activity not found');

    const result = await this.prisma.activity.updateMany({
      where: { id: activityId, deletedAt: null, lead: { organizationId: orgId, deletedAt: null } },
      data: { deletedAt: new Date() },
    });

    if (result.count === 0) throw new NotFoundException('Activity not found');

    await this.leadService.createTimelineEvent(
      orgId, activity.leadId, userId, 'ACTIVITY_DELETED',
      `Activity deleted: ${activity.title}`,
    );

    this.logger.log(`Activity deleted: ${activityId} by ${userId}`);
    return { message: 'Activity deleted successfully' };
  }
}