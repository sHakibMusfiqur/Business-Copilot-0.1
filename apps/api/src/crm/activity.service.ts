import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { LeadService } from './lead.service';

import type { CreateActivityDto } from './dto/create-activity.dto';
import type { QueryActivityDto } from './dto/query-activity.dto';

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leadService: LeadService,
  ) {}

  async findByLead(orgId: string, leadId: string, query: QueryActivityDto) {
    const { page = 1, limit = 20, completed } = query;

    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId: orgId, deletedAt: null },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    const where: { leadId: string; completed?: boolean } = { leadId };
    if (completed !== undefined) where.completed = completed;

    const [total, activities] = await Promise.all([
      this.prisma.activity.count({ where }),
      this.prisma.activity.findMany({
        where,
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          dueDate: true,
          completed: true,
          createdAt: true,
          createdBy: { select: { id: true, name: true } },
        },
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
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        dueDate: true,
        completed: true,
        createdAt: true,
      },
    });

    const typeLabel = dto.type.charAt(0) + dto.type.slice(1).toLowerCase();
    await this.leadService.createTimelineEvent(
      orgId, leadId, userId, 'ACTIVITY_ADDED',
      `${typeLabel} added: ${dto.title}`,
    );

    this.logger.log(`Activity created: ${activity.id} for lead ${leadId}`);
    return activity;
  }

  async toggleComplete(orgId: string, userId: string, activityId: string) {
    const activity = await this.prisma.activity.findFirst({
      where: { id: activityId, lead: { organizationId: orgId } },
      select: { id: true, completed: true, leadId: true, title: true },
    });

    if (!activity) throw new NotFoundException('Activity not found');

    const updated = await this.prisma.activity.update({
      where: { id: activityId },
      data: { completed: !activity.completed },
      select: { id: true, completed: true },
    });

    await this.leadService.createTimelineEvent(
      orgId, activity.leadId, userId, 'ACTIVITY_UPDATED',
      `Activity ${updated.completed ? 'completed' : 'reopened'}: ${activity.title}`,
    );

    return updated;
  }

  async delete(orgId: string, userId: string, activityId: string) {
    const activity = await this.prisma.activity.findFirst({
      where: { id: activityId, lead: { organizationId: orgId } },
    });

    if (!activity) throw new NotFoundException('Activity not found');

    await this.prisma.activity.delete({ where: { id: activityId } });

    this.logger.log(`Activity deleted: ${activityId} by ${userId}`);
    return { message: 'Activity deleted successfully' };
  }
}
