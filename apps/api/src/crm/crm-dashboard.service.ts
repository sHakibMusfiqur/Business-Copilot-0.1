import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import {
  computeFunnel,
  computeRevenueTrend,
  computeSalesCycle,
  percentage,
  round2,
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

/** Resolves the reporting window; defaults to the last 12 months. */
export function resolveRange(query: Pick<QueryCrmReportsDto, 'startDate' | 'endDate'>): CrmDateRange {
  const now = new Date();
  const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (DEFAULT_RANGE_MONTHS - 1), 1));
  const start = query.startDate ? new Date(query.startDate) : defaultStart;
  const end = query.endDate ? new Date(query.endDate) : new Date(now.getTime() + 24 * 60 * 60 * 1000 - 1000);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Invalid date range');
  }
  if (start > end) {
    throw new Error('startDate must be before endDate');
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
          periodStart: { lte: range.end },
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
      this.prisma.lead.count({ where: { organizationId: orgId, deletedAt: null, createdAt: { gte: range.start, lte: range.end } } }),
      this.prisma.contact.count({ where: { organizationId: orgId, deletedAt: null, createdAt: { gte: range.start, lte: range.end } } }),
      this.prisma.deal.count({ where: { organizationId: orgId, deletedAt: null, createdAt: { gte: range.start, lte: range.end } } }),
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

    const wonInPeriod = deals.filter((d) => d.wonAt && d.wonAt >= range.start && d.wonAt <= range.end);
    const lostInPeriod = deals.filter((d) => d.lostAt && d.lostAt >= range.start && d.lostAt <= range.end);
    const openDeals = deals.filter((d) => !d.wonAt && !d.lostAt);

    const revenue = round2(wonInPeriod.reduce((sum, d) => sum + d.value, 0));
    const openPipelineValue = round2(openDeals.reduce((sum, d) => sum + d.value, 0));
    const weightedPipeline = round2(openDeals.reduce((sum, d) => sum + (d.value * d.probability) / 100, 0));
    const closedCount = wonInPeriod.length + lostInPeriod.length;
    const conversionRate = percentage(wonInPeriod.length, closedCount);
    const salesCycle = computeSalesCycle(wonInPeriod);

    const targetAmount = round2(targetRows.reduce((sum, t) => sum + toNumber(t.amount), 0));
    const targetAchievement = targetAmount > 0 ? percentage(revenue, targetAmount) : null;

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

    const targets = targetRows.map((t) => {
      const amount = toNumber(t.amount);
      const achieved = round2(
        wonInPeriod
          .filter((d) => d.ownerId === t.ownerId || (t.ownerId === null && d.ownerId === null))
          .reduce((sum, d) => sum + d.value, 0),
      );
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

    return {
      range: { startDate: range.start.toISOString(), endDate: range.end.toISOString() },
      granularity,
      kpis,
      funnel,
      revenueTrend,
      leaderboard,
      targets,
    };
  }
}
