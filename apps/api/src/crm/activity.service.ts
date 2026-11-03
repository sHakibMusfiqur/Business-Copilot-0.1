import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

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
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
  lead: { select: { id: true, leadNumber: true, name: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
  deal: { select: { id: true, title: true } },
  company: { select: { id: true, name: true } },
} as const;

const ACTIVITY_SUMMARY_SELECT = {
  id: true,
  type: true,
  title: true,
  description: true,
  dueDate: true,
  completed: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  assignedTo: { select: { id: true, name: true } },
  lead: { select: { id: true, leadNumber: true, name: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
  deal: { select: { id: true, title: true } },
  company: { select: { id: true, name: true } },
} as const;

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string, query: QueryActivityDto) {
    const {
      page = 1,
      limit = 20,
      completed,
      type,
      search,
      overdue,
      from,
      to,
      leadId,
      contactId,
      dealId,
      companyId,
      assignedToId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.ActivityWhereInput = {
      deletedAt: null,
      organizationId: orgId,
    };

    if (type) where.type = type;
    if (completed !== undefined) where.completed = completed;
    if (leadId) where.leadId = leadId;
    if (contactId) where.contactId = contactId;
    if (dealId) where.dealId = dealId;
    if (companyId) where.companyId = companyId;
    if (assignedToId) where.assignedToId = assignedToId;

    if (search) {
      const sanitized = search.trim();
      where.OR = [
        { title: { contains: sanitized, mode: 'insensitive' } },
        { description: { contains: sanitized, mode: 'insensitive' } },
      ];
    }

    if (overdue) {
      where.completed = false;
      where.dueDate = { lt: new Date() };
    } else if (from || to) {
      const dueDateFilter: Prisma.DateTimeFilter = {};
      if (from) dueDateFilter.gte = new Date(from);
      if (to) dueDateFilter.lte = new Date(to);
      where.dueDate = dueDateFilter;
    }

    const allowedSortFields = ['dueDate', 'createdAt', 'title'];
    const field = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    const [total, activities] = await Promise.all([
      this.prisma.activity.count({ where }),
      this.prisma.activity.findMany({
        where,
        select: ACTIVITY_SUMMARY_SELECT,
        orderBy: { [field]: order },
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
      where: { id: activityId, deletedAt: null, organizationId: orgId },
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

    const where: Prisma.ActivityWhereInput = { deletedAt: null, organizationId: orgId };
    if (completed !== undefined) where.completed = completed;

    // Include activities where this lead is the primary reference, PLUS any
    // activities that reference this lead via the original leadId field.
    const [total, activities] = await Promise.all([
      this.prisma.activity.count({
        where: { ...where, leadId: leadId },
      }),
      this.prisma.activity.findMany({
        where: { ...where, leadId: leadId },
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

  async findByContact(orgId: string, contactId: string, query: QueryActivityDto) {
    const { page = 1, limit = 20, completed } = query;

    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, organizationId: orgId, deletedAt: null },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    const where: Prisma.ActivityWhereInput = { deletedAt: null, organizationId: orgId };
    if (completed !== undefined) where.completed = completed;

    const [total, activities] = await Promise.all([
      this.prisma.activity.count({
        where: { ...where, contactId: contactId },
      }),
      this.prisma.activity.findMany({
        where: { ...where, contactId: contactId },
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

  async findByDeal(orgId: string, dealId: string, query: QueryActivityDto) {
    const { page = 1, limit = 20, completed } = query;

    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, organizationId: orgId, deletedAt: null },
    });
    if (!deal) throw new NotFoundException('Deal not found');

    const where: Prisma.ActivityWhereInput = { deletedAt: null, organizationId: orgId };
    if (completed !== undefined) where.completed = completed;

    const [total, activities] = await Promise.all([
      this.prisma.activity.count({
        where: { ...where, dealId: dealId },
      }),
      this.prisma.activity.findMany({
        where: { ...where, dealId: dealId },
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

  async create(organizationId: string, userId: string, dto: CreateActivityDto) {
    // Validate that at least one entity reference is provided
    if (!dto.leadId && !dto.contactId && !dto.dealId && !dto.companyId) {
      throw new BadRequestException('Activity must reference at least one entity: leadId, contactId, dealId, or companyId');
    }

    // At most one primary entity reference is allowed
    const entityRefs = [dto.leadId, dto.contactId, dto.dealId, dto.companyId].filter(Boolean);
    if (entityRefs.length > 1) {
      throw new BadRequestException('Activity can reference only one primary entity');
    }

    await this.assertRefsAccessible(organizationId, dto);

    const activity = await this.prisma.activity.create({
      data: {
        organizationId,
        type: dto.type,
        title: dto.title,
        description: dto.description ?? null,
        dueDate: dto.dueDate ?? null,
        completed: dto.completed ?? false,
        leadId: dto.leadId ?? null,
        contactId: dto.contactId ?? null,
        dealId: dto.dealId ?? null,
        companyId: dto.companyId ?? null,
        assignedToId: dto.assignedToId ?? null,
        createdById: userId,
      },
      select: ACTIVITY_SUMMARY_SELECT,
    });

    this.logger.log(`Activity created: ${activity.id} by ${userId}`);
    return activity;
  }

  async update(orgId: string, userId: string, activityId: string, dto: UpdateActivityDto) {
    const existing = await this.prisma.activity.findFirst({
      where: { id: activityId, deletedAt: null, organizationId: orgId },
      select: { id: true, type: true, title: true, leadId: true, contactId: true, dealId: true, companyId: true, assignedToId: true, createdById: true },
    });

    if (!existing) throw new NotFoundException('Activity not found');

    const updateData: Prisma.ActivityUpdateInput = {};
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.title !== undefined) updateData.title = dto.title.trim();
    if (dto.description !== undefined) updateData.description = dto.description?.trim();
    if (dto.dueDate !== undefined) updateData.dueDate = dto.dueDate;
    if (dto.completed !== undefined) updateData.completed = dto.completed;

    const updated = await this.prisma.activity.update({
      where: { id: activityId, deletedAt: null, organizationId: orgId },
      data: updateData,
      select: { ...ACTIVITY_SUMMARY_SELECT, leadId: true, contactId: true, dealId: true, companyId: true, assignedToId: true },
    }).catch((err: unknown) => {
      if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2025') {
        throw new NotFoundException('Activity not found');
      }
      throw err;
    });

    this.logger.log(`Activity updated: ${activityId} by ${userId}`);
    return updated;
  }

  async toggleComplete(orgId: string, userId: string, activityId: string) {
    const activity = await this.prisma.activity.findFirst({
      where: { id: activityId, deletedAt: null, organizationId: orgId },
      select: { id: true, completed: true, title: true, leadId: true, contactId: true, dealId: true, companyId: true },
    });

    if (!activity) throw new NotFoundException('Activity not found');

    const result = await this.prisma.activity.update({
      where: { id: activityId, deletedAt: null, organizationId: orgId },
      data: { completed: !activity.completed, completedAt: !activity.completed ? new Date() : null },
    }).catch((err: unknown) => {
      if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2025') {
        throw new NotFoundException('Activity not found');
      }
      throw err;
    });

    this.logger.log(`Activity ${result.completed ? 'completed' : 'reopened'}: ${activity.id} by ${userId}`);
    return result;
  }

  async delete(orgId: string, userId: string, activityId: string) {
    const existing = await this.prisma.activity.findFirst({
      where: { id: activityId, deletedAt: null, organizationId: orgId },
      select: { id: true, title: true, type: true, leadId: true, contactId: true, dealId: true, companyId: true },
    });

    if (!existing) throw new NotFoundException('Activity not found');

    await this.prisma.activity.update({
      where: { id: activityId, deletedAt: null, organizationId: orgId },
      data: { deletedAt: new Date() },
    }).catch((err: unknown) => {
      if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2025') {
        throw new NotFoundException('Activity not found');
      }
      throw err;
    });

    this.logger.log(`Activity deleted: ${existing.id} by ${userId}`);
    return { message: 'Activity deleted successfully' };
  }

  /** Ensures every referenced entity (and assignee) belongs to the organization. */
  private async assertRefsAccessible(organizationId: string, dto: CreateActivityDto): Promise<void> {
    if (dto.leadId) {
      const lead = await this.prisma.lead.findFirst({
        where: { id: dto.leadId, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!lead) throw new BadRequestException('Lead not found or not accessible to this organization');
    }
    if (dto.contactId) {
      const contact = await this.prisma.contact.findFirst({
        where: { id: dto.contactId, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!contact) throw new BadRequestException('Contact not found or not accessible to this organization');
    }
    if (dto.dealId) {
      const deal = await this.prisma.deal.findFirst({
        where: { id: dto.dealId, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!deal) throw new BadRequestException('Deal not found or not accessible to this organization');
    }
    if (dto.companyId) {
      const company = await this.prisma.company.findFirst({
        where: { id: dto.companyId, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!company) throw new BadRequestException('Company not found or not accessible to this organization');
    }
    if (dto.assignedToId) {
      const user = await this.prisma.user.findFirst({
        where: { id: dto.assignedToId, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!user) throw new BadRequestException('Assignee not found or not accessible to this organization');
    }
  }
}