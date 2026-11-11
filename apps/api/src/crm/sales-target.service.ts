import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { parseStrictIsoDate, startOfDay, startOfNextUtcDay } from './crm-metrics';

import type { CreateSalesTargetDto } from './dto/create-sales-target.dto';
import type { UpdateSalesTargetDto } from './dto/update-sales-target.dto';
import type { QuerySalesTargetsDto } from './dto/query-sales-targets.dto';

const TARGET_SELECT = {
  id: true,
  ownerId: true,
  owner: { select: { id: true, name: true, email: true } },
  periodStart: true,
  periodEnd: true,
  amount: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

@Injectable()
export class SalesTargetService {
  private readonly logger = new Logger(SalesTargetService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string, query: QuerySalesTargetsDto) {
    const where: Prisma.SalesTargetWhereInput = { organizationId: orgId };

    if (query.ownerId) where.ownerId = query.ownerId;
    if (query.from || query.to) {
      where.periodStart = {};
      where.periodEnd = {};
      // Day-scoped overlap: `from` compares against the start of its day (a
      // target ending any time on that day still overlaps) and `to` against
      // the exclusive next-day boundary (a target starting any time on that
      // day still overlaps). Date-only inputs behave exactly as before.
      // Strict calendar validation: 2026-02-30 must be a 400, not a silent
      // roll-over to 2026-03-02 feeding Prisma a different day.
      if (query.from) {
        const from = parseStrictIsoDate(query.from);
        if (from === null) throw new BadRequestException('Invalid from date');
        where.periodEnd = { gte: startOfDay(from) };
      }
      if (query.to) {
        const to = parseStrictIsoDate(query.to);
        if (to === null) throw new BadRequestException('Invalid to date');
        where.periodStart = { lt: startOfNextUtcDay(to) };
      }
    }

    const targets = await this.prisma.salesTarget.findMany({
      where,
      select: TARGET_SELECT,
      orderBy: { periodStart: 'desc' },
    });

    // Single fetch for every won deal that can fall inside any target period
    // (previously one aggregate query per target — N+1). Per-target predicates
    // are applied in memory exactly as the per-target aggregates did.
    // The window's upper bound is the exclusive next-day boundary of the LATEST
    // periodEnd so deals won at any time on that end date (noon, 23:59, …)
    // are fetched rather than cut off at midnight.
    let wonDeals: Array<{ value: Prisma.Decimal; ownerId: string | null; wonAt: Date | null }> = [];
    if (targets.length > 0) {
      const minStart = new Date(Math.min(...targets.map((t) => t.periodStart.getTime())));
      const maxEndExclusive = startOfNextUtcDay(
        new Date(Math.max(...targets.map((t) => t.periodEnd.getTime()))),
      );
      wonDeals = await this.prisma.deal.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          wonAt: { gte: minStart, lt: maxEndExclusive },
        },
        select: { value: true, ownerId: true, wonAt: true },
      });
    }

    const data = targets.map((target) => {
      // periodEnd is day-scoped: the whole end DATE is part of the period.
      // `< startOfNextUtcDay(periodEnd)` is the exclusive-boundary form of
      // "won at any time through the end of that day" — a deal won exactly at
      // the next day's start is excluded.
      const periodEndExclusive = startOfNextUtcDay(target.periodEnd);
      const inPeriod = wonDeals.filter(
        (d) =>
          d.wonAt !== null &&
          d.wonAt >= target.periodStart &&
          d.wonAt < periodEndExclusive &&
          (target.ownerId ? d.ownerId === target.ownerId : true),
      );

      // Exact decimal accumulation, matching the previous Prisma _sum result.
      let sum = new Prisma.Decimal(0);
      for (const d of inPeriod) sum = sum.plus(d.value);

      const amount = toNumber(target.amount);
      const achieved = toNumber(sum);

      return {
        ...target,
        amount,
        achieved,
        wonCount: inPeriod.length,
        achievement: amount > 0 ? Math.round((achieved / amount) * 1000) / 10 : 0,
      };
    });

    return { data, meta: { total: data.length, page: 1, limit: data.length, totalPages: 1 } };
  }

  async findById(orgId: string, targetId: string) {
    const target = await this.prisma.salesTarget.findFirst({
      where: { id: targetId, organizationId: orgId },
      select: TARGET_SELECT,
    });
    if (!target) throw new NotFoundException('Sales target not found');

    const achievedAgg = await this.prisma.deal.aggregate({
      where: {
        organizationId: orgId,
        deletedAt: null,
        // Day-scoped periodEnd (exclusive next-day boundary) — must stay in
        // lockstep with findAll so a target's achieved value is identical
        // however it is looked up.
        wonAt: { gte: target.periodStart, lt: startOfNextUtcDay(target.periodEnd) },
        ...(target.ownerId ? { ownerId: target.ownerId } : {}),
      },
      _sum: { value: true },
      _count: { id: true },
    });

    const amount = toNumber(target.amount);
    const achieved = toNumber(achievedAgg._sum.value);

    return {
      ...target,
      amount,
      achieved,
      wonCount: achievedAgg._count.id,
      achievement: amount > 0 ? Math.round((achieved / amount) * 1000) / 10 : 0,
    };
  }

  async create(orgId: string, userId: string, dto: CreateSalesTargetDto) {
    const periodStart = parseStrictIsoDate(dto.periodStart);
    const periodEnd = parseStrictIsoDate(dto.periodEnd);
    if (periodStart === null || periodEnd === null) {
      // Invalid or impossible calendar dates (2026-02-30 → silently
      // 2026-03-02 via `new Date()`) must be a 400, not a Prisma/serialization
      // failure — or worse, stored as a different day.
      throw new BadRequestException('Invalid periodStart or periodEnd');
    }
    if (periodStart > periodEnd) {
      throw new BadRequestException('periodStart must be on or before periodEnd');
    }
    if (dto.ownerId) await this.assertOwnerAccessible(orgId, dto.ownerId);

    const target = await this.prisma.salesTarget
      .create({
        data: {
          organizationId: orgId,
          ownerId: dto.ownerId ?? null,
          periodStart,
          periodEnd,
          amount: new Prisma.Decimal(dto.amount),
          notes: dto.notes ?? null,
        },
        select: TARGET_SELECT,
      })
      .catch((err: unknown) => {
        if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
          throw new ConflictException('A target already exists for this owner and period start');
        }
        throw err;
      });

    this.logger.log(`Sales target created: ${target.id} by ${userId}`);
    return { ...target, amount: toNumber(target.amount) };
  }

  async update(orgId: string, userId: string, targetId: string, dto: UpdateSalesTargetDto) {
    const existing = await this.prisma.salesTarget.findFirst({
      where: { id: targetId, organizationId: orgId },
      select: { id: true, periodStart: true, periodEnd: true, ownerId: true },
    });
    if (!existing) throw new NotFoundException('Sales target not found');

    const periodStart = dto.periodStart ? parseStrictIsoDate(dto.periodStart) : existing.periodStart;
    const periodEnd = dto.periodEnd ? parseStrictIsoDate(dto.periodEnd) : existing.periodEnd;
    if (periodStart === null || periodEnd === null) {
      // Same strict validation as create: impossible calendar dates are a 400
      // and never reach Prisma.
      throw new BadRequestException('Invalid periodStart or periodEnd');
    }
    if (periodStart > periodEnd) {
      throw new BadRequestException('periodStart must be on or before periodEnd');
    }
    if (dto.ownerId) await this.assertOwnerAccessible(orgId, dto.ownerId);

    const updateData: Prisma.SalesTargetUpdateInput = {};
    if (dto.periodStart !== undefined) updateData.periodStart = periodStart;
    if (dto.periodEnd !== undefined) updateData.periodEnd = periodEnd;
    if (dto.amount !== undefined) updateData.amount = new Prisma.Decimal(dto.amount);
    if (dto.notes !== undefined) updateData.notes = dto.notes;
    if (dto.ownerId !== undefined) {
      updateData.owner = dto.ownerId ? { connect: { id: dto.ownerId } } : { disconnect: true };
    }

    const updated = await this.prisma.salesTarget
      .update({
        where: { id: targetId, organizationId: orgId },
        data: updateData,
        select: TARGET_SELECT,
      })
      .catch((err: unknown) => {
        if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2025') {
          throw new NotFoundException('Sales target not found');
        }
        if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
          throw new ConflictException('A target already exists for this owner and period start');
        }
        throw err;
      });

    this.logger.log(`Sales target updated: ${targetId} by ${userId}`);
    return { ...updated, amount: toNumber(updated.amount) };
  }

  async remove(orgId: string, userId: string, targetId: string) {
    const existing = await this.prisma.salesTarget.findFirst({
      where: { id: targetId, organizationId: orgId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Sales target not found');

    // Org scope on the write itself (not just the preceding findFirst) so the
    // delete cannot cross tenants even if the row changes hands concurrently.
    await this.prisma.salesTarget.delete({ where: { id: targetId, organizationId: orgId } });

    this.logger.log(`Sales target deleted: ${targetId} by ${userId}`);
    return { message: 'Sales target deleted successfully' };
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
