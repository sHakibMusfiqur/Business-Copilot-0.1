import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import {
  computeFunnel,
  computeRevenueTrend,
  computeSalesCycle,
  parseStrictIsoDate,
  percentage,
  round2,
  startOfDay,
  startOfNextUtcDay,
  type MetricDeal,
  type MetricStage,
  type StageReach,
  type Granularity,
} from './crm-metrics';

import type { QueryCrmReportsDto } from './dto/query-crm-reports.dto';

const DEFAULT_RANGE_MONTHS = 12;

export interface CrmDateRange {
  start: Date;
  end: Date;
}

/**
 * Resolves the reporting window; defaults to the last 12 months.
 *
 * Date semantics (all boundaries are UTC days):
 * - `start` is INCLUSIVE: it is the 00:00 start of the selected start day, so
 *   the entire first day is covered.
 * - `end` is EXCLUSIVE: it is 00:00 of the day AFTER the selected end day, so
 *   the entire end day (through 23:59:59.999) is covered without fragile
 *   `- 1ms` comparisons. Consumers must compare with `< range.end`.
 * - With no `endDate`, the range ends at the boundary of the CURRENT day
 *   (tomorrow 00:00 UTC exclusive) — never ~24 hours into the future.
 *
 * Invalid, unparsable, or impossible calendar dates (e.g. 2026-02-30, which
 * `new Date()` would silently roll over to 2026-03-02) and inverted ranges
 * throw BadRequestException (HTTP 400).
 */
export function resolveRange(query: Pick<QueryCrmReportsDto, 'startDate' | 'endDate'>): CrmDateRange {
  const now = new Date();
  const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (DEFAULT_RANGE_MONTHS - 1), 1));
  const parsedStart = query.startDate ? parseStrictIsoDate(query.startDate) : defaultStart;
  const parsedEnd = query.endDate ? parseStrictIsoDate(query.endDate) : now;

  if (parsedStart === null || parsedEnd === null) {
    throw new BadRequestException('Invalid startDate or endDate');
  }

  const start = startOfDay(parsedStart);
  const end = startOfNextUtcDay(parsedEnd);

  if (start.getTime() >= end.getTime()) {
    throw new BadRequestException('startDate must be on or before endDate');
  }
  return { start, end };
}

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

@Injectable()
export class CrmDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** Dashboard payload: KPIs, stage funnel, revenue trend and target progress. */
  async getDashboard(orgId: string, query: QueryCrmReportsDto) {
    const report = await this.buildReport(orgId, query);
    return {
      range: report.range,
      kpis: report.kpis,
      funnel: report.funnel,
      revenueTrend: report.revenueTrend,
    };
  }

  /** Full reports payload: dashboard data plus leaderboard and sales targets. */
  async getReports(orgId: string, query: QueryCrmReportsDto) {
    return this.buildReport(orgId, query);
  }

  private async buildReport(orgId: string, query: QueryCrmReportsDto) {
    const range = resolveRange(query);
    const granularity: Granularity = query.granularity ?? 'month';
    const ownerId = query.ownerId;

    const [pipelines, dealRows, historyRows, targetRows, leadCount, contactCount, dealCount] = await Promise.all([
      this.prisma.pipeline.findMany({
        where: { deletedAt: null, isActive: true, OR: [{ organizationId: orgId }, { organizationId: null }] },
        select: {
          id: true,
          name: true,
          isDefault: true,
          stages: {
            where: { deletedAt: null, isActive: true },
            orderBy: { position: 'asc' },
            select: { id: true, name: true, position: true, isWon: true, isLost: true },
          },
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      }),
      this.prisma.deal.findMany({
        where: { organizationId: orgId, deletedAt: null, ...(ownerId ? { ownerId } : {}) },
        select: {
          id: true,
          title: true,
          value: true,
          probability: true,
          stageId: true,
          pipelineId: true,
          ownerId: true,
          owner: { select: { id: true, name: true, email: true } },
          createdAt: true,
          wonAt: true,
          lostAt: true,
          expectedCloseDate: true,
        },
      }),
      this.prisma.dealStageHistory.findMany({
        where: { deal: { organizationId: orgId, deletedAt: null } },
        select: { dealId: true, toStageId: true },
      }),
      this.prisma.salesTarget.findMany({
        where: {
          organizationId: orgId,
          // range.end is the exclusive next-day boundary: a target starting
          // any time on the last covered day still overlaps the range.
          periodStart: { lt: range.end },
          periodEnd: { gte: range.start },
          ...(ownerId ? { ownerId } : {}),
        },
        select: {
          id: true,
          ownerId: true,
          owner: { select: { id: true, name: true, email: true } },
          periodStart: true,
          periodEnd: true,
          amount: true,
          notes: true,
        },
        orderBy: { periodStart: 'asc' },
      }),
      this.prisma.lead.count({ where: { organizationId: orgId, deletedAt: null, createdAt: { gte: range.start, lt: range.end } } }),
      this.prisma.contact.count({ where: { organizationId: orgId, deletedAt: null, createdAt: { gte: range.start, lt: range.end } } }),
      this.prisma.deal.count({ where: { organizationId: orgId, deletedAt: null, createdAt: { gte: range.start, lt: range.end } } }),
    ]);

    const deals: MetricDeal[] = dealRows.map((d) => ({
      id: d.id,
      value: toNumber(d.value),
      probability: d.probability,
      stageId: d.stageId,
      ownerId: d.ownerId,
      createdAt: d.createdAt,
      wonAt: d.wonAt,
      lostAt: d.lostAt,
      expectedCloseDate: d.expectedCloseDate,
    }));

    const stages: MetricStage[] = pipelines.flatMap((p) => p.stages);
    const reach: StageReach[] = historyRows.map((row) => ({ dealId: row.dealId, stageId: row.toStageId }));

    // range.end is exclusive (next-day start): won/lost stamps at any time on
    // the last covered day — 23:59 included — are in range; a stamp exactly at
    // the next day's start is not.
    const wonInPeriod = deals.filter((d) => d.wonAt && d.wonAt >= range.start && d.wonAt < range.end);
    const lostInPeriod = deals.filter((d) => d.lostAt && d.lostAt >= range.start && d.lostAt < range.end);
    const openDeals = deals.filter((d) => !d.wonAt && !d.lostAt);

    const revenue = round2(wonInPeriod.reduce((sum, d) => sum + d.value, 0));
    const openPipelineValue = round2(openDeals.reduce((sum, d) => sum + d.value, 0));
    const weightedPipeline = round2(openDeals.reduce((sum, d) => sum + (d.value * d.probability) / 100, 0));
    const closedCount = wonInPeriod.length + lostInPeriod.length;
    const conversionRate = percentage(wonInPeriod.length, closedCount);
    const salesCycle = computeSalesCycle(wonInPeriod);

    const funnel = computeFunnel(stages, deals, reach);
    const revenueTrend = computeRevenueTrend(wonInPeriod, range, granularity);

    const ownerAgg = new Map<string, { ownerId: string; name: string; email: string; wonCount: number; wonRevenue: number; openCount: number; openValue: number }>();
    const ownerName = new Map<string, { name: string; email: string }>();
    for (const row of dealRows) {
      if (row.owner) ownerName.set(row.owner.id, { name: row.owner.name, email: row.owner.email });
    }
    for (const owner of ownerName) {
      ownerAgg.set(owner[0], { ownerId: owner[0], name: owner[1].name, email: owner[1].email, wonCount: 0, wonRevenue: 0, openCount: 0, openValue: 0 });
    }
    for (const d of wonInPeriod) {
      if (!d.ownerId) continue;
      const entry = ownerAgg.get(d.ownerId);
      if (entry) {
        entry.wonCount += 1;
        entry.wonRevenue = round2(entry.wonRevenue + d.value);
      }
    }
    for (const d of openDeals) {
      if (!d.ownerId) continue;
      const entry = ownerAgg.get(d.ownerId);
      if (entry) {
        entry.openCount += 1;
        entry.openValue = round2(entry.openValue + d.value);
      }
    }

    const leaderboardLimit = query.leaderboardLimit ?? 10;
    const leaderboard = [...ownerAgg.values()]
      .sort((a, b) => b.wonRevenue - a.wonRevenue || b.openValue - a.openValue)
      .slice(0, leaderboardLimit);

    // Each target is measured against its OWN period, using the same owner
    // semantics as SalesTargetService.findAll: an owner-specific target counts
    // that owner's won deals in the target period; an org-wide target
    // (ownerId null) counts all org deals won in that period. periodEnd is
    // day-scoped: deals won at any time ON the end date (noon, 23:59, …) are
    // included via the exclusive next-day boundary — identical to
    // SalesTargetService.findAll/findById.
    const targets = targetRows.map((t) => {
      const amount = toNumber(t.amount);
      // Exact decimal accumulation over the RAW Prisma rows — `dealRows`
      // keeps `value` as Prisma.Decimal — matching SalesTargetService's
      // precision behaviour (`let sum = new Prisma.Decimal(0);
      // sum = sum.plus(d.value)`, converted to a number only once at the end).
      // JavaScript number accumulation (0.1 + 0.2 → 0.30000000000000004) can
      // no longer leak into achievement figures.
      let achievedSum = new Prisma.Decimal(0);
      for (const d of dealRows) {
        if (
          d.wonAt !== null &&
          d.wonAt >= t.periodStart &&
          d.wonAt < startOfNextUtcDay(t.periodEnd) &&
          (t.ownerId ? d.ownerId === t.ownerId : true)
        ) {
          achievedSum = achievedSum.plus(d.value);
        }
      }
      const achieved = round2(toNumber(achievedSum));
      return {
        id: t.id,
        ownerId: t.ownerId,
        owner: t.owner,
        periodStart: t.periodStart,
        periodEnd: t.periodEnd,
        amount,
        notes: t.notes,
        achieved,
        achievement: amount > 0 ? percentage(achieved, amount) : 0,
      };
    });

    // Achievement KPI uses the same per-target periods as the rows above, so
    // numerator and denominator are measured consistently (no more whole-range
    // revenue against summed target amounts).
    const targetAmount = round2(targets.reduce((sum, t) => sum + t.amount, 0));
    const achievedTotal = round2(targets.reduce((sum, t) => sum + t.achieved, 0));
    const targetAchievement = targetAmount > 0 ? percentage(achievedTotal, targetAmount) : null;

    const kpis = {
      revenue,
      wonCount: wonInPeriod.length,
      lostCount: lostInPeriod.length,
      openDealCount: openDeals.length,
      openPipelineValue,
      weightedPipeline,
      conversionRate,
      averageSalesCycleDays: salesCycle.averageDays,
      medianSalesCycleDays: salesCycle.medianDays,
      salesCycleSampleSize: salesCycle.sampleSize,
      targetAmount,
      targetAchievement,
      newLeadCount: leadCount,
      newContactCount: contactCount,
      newDealCount: dealCount,
    };

    // Internally `range.end` is an exclusive next-day bound; the payload
    // reports the LAST INCLUDED DAY (00:00) so the API keeps returning a
    // display-friendly date that matches the day the user selected — never a
    // timestamp ~24h in the future.
    const lastCoveredDay = new Date(range.end.getTime() - 86_400_000);
    return {
      range: { startDate: range.start.toISOString(), endDate: lastCoveredDay.toISOString() },
      granularity,
      kpis,
      funnel,
      revenueTrend,
      leaderboard,
      targets,
    };
  }
}
