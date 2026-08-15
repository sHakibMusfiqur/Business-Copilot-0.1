import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma, LeadStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type { CreateLeadDto } from './dto/create-lead.dto';
import type { UpdateLeadDto } from './dto/update-lead.dto';
import type { QueryLeadDto } from './dto/query-lead.dto';

@Injectable()
export class LeadService {
  private readonly logger = new Logger(LeadService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string, query: QueryLeadDto) {
    const { page = 1, limit = 10, search, status, assignedToId, sortBy = 'createdAt', sortOrder = 'desc' } = query;

    const where: Prisma.LeadWhereInput = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (search) {
      const sanitized = search.trim();
      where.OR = [
        { leadNumber: { contains: sanitized, mode: 'insensitive' } },
        { name: { contains: sanitized, mode: 'insensitive' } },
        { company: { contains: sanitized, mode: 'insensitive' } },
        { email: { contains: sanitized, mode: 'insensitive' } },
      ];
    }

    if (status) where.status = status;
    if (assignedToId) where.assignedToId = assignedToId;

    const allowedSortFields = ['leadNumber', 'name', 'company', 'status', 'estimatedValue', 'createdAt'];
    const field = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    const [total, leads] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({
        where,
        select: {
          id: true,
          leadNumber: true,
          name: true,
          company: true,
          email: true,
          phone: true,
          source: true,
          status: true,
          estimatedValue: true,
          assignedToId: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          assignedTo: { select: { id: true, name: true } },
          activities: { where: { deletedAt: null }, select: { id: true } },
        },
        orderBy: { [field]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const data = leads.map((l) => ({
      ...l,
      estimatedValue: Number(l.estimatedValue),
      activityCount: l.activities.length,
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(orgId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId: orgId, deletedAt: null },
      select: {
        id: true,
        leadNumber: true,
        name: true,
        company: true,
        email: true,
        phone: true,
        source: true,
        status: true,
        estimatedValue: true,
        assignedToId: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        assignedTo: { select: { id: true, name: true } },
        convertedToCustomer: { select: { id: true, name: true } },
      },
    });

    if (!lead) throw new NotFoundException('Lead not found');
    return { ...lead, estimatedValue: Number(lead.estimatedValue) };
  }

  async create(orgId: string, userId: string, dto: CreateLeadDto) {
    if (dto.assignedToId) {
      await this.assertAssigneeAccessible(orgId, dto.assignedToId);
    }

    const maxRetries = 5;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const leadNumber = await this.generateLeadNumber(orgId);

      try {
        const lead = await this.prisma.lead.create({
          data: {
            leadNumber,
            organizationId: orgId,
            name: dto.name,
            company: dto.company ?? null,
            email: dto.email ?? null,
            phone: dto.phone ?? null,
            source: dto.source ?? null,
            status: dto.status ?? LeadStatus.NEW,
            estimatedValue: dto.estimatedValue ?? 0,
            assignedToId: dto.assignedToId ?? null,
            notes: dto.notes ?? null,
          },
          select: {
            id: true,
            leadNumber: true,
            name: true,
            status: true,
            createdAt: true,
          },
        });

        await this.createTimelineEvent(orgId, lead.id, userId, 'CREATED', `Lead created: ${lead.leadNumber}`);

        this.logger.log(`Lead created: ${lead.leadNumber} (${lead.id}) by ${userId}`);
        return lead;
      } catch (err) {
        if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
          if (attempt < maxRetries) {
            this.logger.warn(`Lead number collision for ${leadNumber}, retrying (${attempt}/${maxRetries})`);
            continue;
          }
          break;
        }
        throw err;
      }
    }

    throw new InternalServerErrorException('Failed to create lead due to lead number collision. Please try again.');
  }

  async update(orgId: string, userId: string, leadId: string, dto: UpdateLeadDto) {
    const existing = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId: orgId, deletedAt: null },
    });

    if (!existing) throw new NotFoundException('Lead not found');

    const updateData: Prisma.LeadUpdateInput = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.company !== undefined) updateData.company = dto.company;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.source !== undefined) updateData.source = dto.source;
    if (dto.estimatedValue !== undefined) updateData.estimatedValue = dto.estimatedValue;
    if (dto.assignedToId !== undefined) {
      if (dto.assignedToId) {
        await this.assertAssigneeAccessible(orgId, dto.assignedToId);
      }
      updateData.assignedTo = dto.assignedToId
        ? { connect: { id: dto.assignedToId } }
        : { disconnect: true };
    }
    if (dto.notes !== undefined) updateData.notes = dto.notes;

    if (dto.status !== undefined && dto.status !== existing.status) {
      if (existing.status === LeadStatus.WON || existing.status === LeadStatus.LOST) {
        throw new BadRequestException('Cannot change status of a closed lead (WON or LOST)');
      }
      updateData.status = dto.status;
    }

    const updated = await this.prisma.lead
      .update({
        where: { id: leadId, organizationId: orgId, deletedAt: null },
        data: updateData,
        select: {
          id: true,
          leadNumber: true,
          name: true,
          status: true,
          updatedAt: true,
        },
      })
      .catch((err: unknown) => {
        if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2025') {
          throw new NotFoundException('Lead not found');
        }
        throw err;
      });

    let timelineDescription = `Lead updated: ${updated.leadNumber}`;
    if (dto.status && dto.status !== existing.status) {
      timelineDescription = `Status changed from ${existing.status} to ${dto.status}`;
    }

    await this.createTimelineEvent(orgId, leadId, userId, 'STATUS_CHANGE', timelineDescription);

    this.logger.log(`Lead updated: ${updated.leadNumber} (${leadId}) by ${userId}`);
    return updated;
  }

  async updateStatus(orgId: string, userId: string, leadId: string, status: LeadStatus) {
    const existing = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId: orgId, deletedAt: null },
    });

    if (!existing) throw new NotFoundException('Lead not found');

    if (status === existing.status) {
      return { id: leadId, status, message: 'Lead status unchanged' };
    }

    if (existing.status === LeadStatus.WON || existing.status === LeadStatus.LOST) {
      throw new BadRequestException('Cannot change status of a closed lead (WON or LOST)');
    }

    const updated = await this.prisma.lead
      .update({
        where: { id: leadId, organizationId: orgId, deletedAt: null },
        data: { status },
        select: { id: true, leadNumber: true, status: true },
      })
      .catch((err: unknown) => {
        if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2025') {
          throw new NotFoundException('Lead not found');
        }
        throw err;
      });

    await this.createTimelineEvent(
      orgId, leadId, userId, 'STATUS_CHANGE',
      `Status changed from ${existing.status} to ${status}`,
    );

    this.logger.log(`Lead status updated: ${updated.leadNumber} -> ${status}`);
    return updated;
  }

  async assignUser(orgId: string, userId: string, leadId: string, assignedToId: string | null) {
    const existing = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId: orgId, deletedAt: null },
    });

    if (!existing) throw new NotFoundException('Lead not found');

    if (assignedToId) {
      await this.assertAssigneeAccessible(orgId, assignedToId);
    }

    const updated = await this.prisma.lead
      .update({
        where: { id: leadId, organizationId: orgId, deletedAt: null },
        data: { assignedToId },
        select: { id: true, leadNumber: true, assignedToId: true },
      })
      .catch((err: unknown) => {
        if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2025') {
          throw new NotFoundException('Lead not found');
        }
        throw err;
      });

    const user = assignedToId
      ? await this.prisma.user.findUnique({
          where: { id: assignedToId, organizationId: orgId },
          select: { name: true },
        })
      : null;

    await this.createTimelineEvent(
      orgId, leadId, userId, 'ASSIGNED',
      user ? `Lead assigned to ${user.name}` : 'Lead unassigned',
    );

    this.logger.log(`Lead assigned: ${updated.leadNumber} -> ${assignedToId ?? 'unassigned'}`);
    return updated;
  }

  async softDelete(orgId: string, userId: string, leadId: string) {
    const existing = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId: orgId, deletedAt: null },
    });

    if (!existing) throw new NotFoundException('Lead not found');

    await this.prisma.lead
      .update({
        where: { id: leadId, organizationId: orgId, deletedAt: null },
        data: { deletedAt: new Date() },
      })
      .catch((err: unknown) => {
        if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2025') {
          throw new NotFoundException('Lead not found');
        }
        throw err;
      });

    this.logger.log(`Lead deleted: ${existing.leadNumber} (${leadId}) by ${userId}`);
    return { message: 'Lead deleted successfully' };
  }

  async getSummary(orgId: string) {
    const [total, byStatus, totalValue, activities] = await Promise.all([
      this.prisma.lead.count({ where: { organizationId: orgId, deletedAt: null } }),
      this.prisma.lead.groupBy({
        by: ['status'],
        where: { organizationId: orgId, deletedAt: null },
        _count: { id: true },
      }),
      this.prisma.lead.aggregate({
        where: { organizationId: orgId, deletedAt: null },
        _sum: { estimatedValue: true },
      }),
      this.prisma.activity.findMany({
        where: {
          deletedAt: null,
          lead: { organizationId: orgId, deletedAt: null },
          completed: false,
          dueDate: { not: null },
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
        select: {
          id: true,
          title: true,
          dueDate: true,
          type: true,
          lead: { select: { id: true, leadNumber: true, name: true } },
        },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const s of byStatus) {
      statusMap[s.status] = s._count.id;
    }

    const wonCount = statusMap['WON'] ?? 0;
    const lostCount = statusMap['LOST'] ?? 0;
    const qualifiedCount = statusMap['QUALIFIED'] ?? 0;
    const totalClosed = wonCount + lostCount;
    const conversionRate = totalClosed > 0 ? Math.round((wonCount / totalClosed) * 100) : 0;

    return {
      totalLeads: total,
      qualifiedLeads: qualifiedCount,
      wonLeads: wonCount,
      lostLeads: lostCount,
      pipelineValue: Math.round(Number(totalValue._sum.estimatedValue ?? 0) * 100) / 100,
      conversionRate,
      upcomingActivities: activities,
    };
  }

  async getTimeline(orgId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId: orgId, deletedAt: null },
    });

    if (!lead) throw new NotFoundException('Lead not found');

    const events = await this.prisma.timelineEvent.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        description: true,
        metadata: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true } },
      },
    });

    return { data: events };
  }

  async createTimelineEvent(
    orgId: string,
    leadId: string,
    userId: string,
    type: string,
    description: string,
    metadata?: Record<string, unknown>,
  ) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });

    if (!lead) throw new NotFoundException('Lead not found');

    return this.prisma.timelineEvent.create({
      data: {
        leadId,
        type,
        description,
        metadata: (metadata ?? null) as Prisma.InputJsonValue,
        createdById: userId,
      },
    });
  }

  private async generateLeadNumber(orgId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `LD-${year}-`;

    const lastLead = await this.prisma.lead.findFirst({
      where: { organizationId: orgId, leadNumber: { startsWith: prefix } },
      orderBy: { leadNumber: 'desc' },
      select: { leadNumber: true },
    });

    let nextSeq = 1;
    if (lastLead) {
      const parts = lastLead.leadNumber.split('-');
      nextSeq = parseInt(parts[parts.length - 1], 10) + 1;
    }

    return `${prefix}${String(nextSeq).padStart(6, '0')}`;
  }

  private async assertAssigneeAccessible(orgId: string, userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });

    if (!user) {
      throw new BadRequestException('Assignee not found or not accessible to this organization');
    }
  }
}
