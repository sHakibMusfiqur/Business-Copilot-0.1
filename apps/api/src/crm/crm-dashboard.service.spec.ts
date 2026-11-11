import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CrmDashboardController } from './crm-dashboard.controller';
import { CrmDashboardService, resolveRange } from './crm-dashboard.service';
import { QueryCrmReportsDto } from './dto/query-crm-reports.dto';

/**
 * Regression tests for CRM date-range handling:
 * - date-only endDate covers the ENTIRE selected day (11:59 PM included)
 * - the default range ends at the current day boundary (never ~24h in future);
 *   tested with Jest fake timers at fixed UTC instants — never the real clock
 * - a stamp exactly at the next day's start is excluded (exclusive bound)
 * - inverted ranges surface as HTTP 400 (BadRequestException)
 * - impossible calendar dates (2026-02-30) are rejected, never rolled over
 * - target periodEnd covers the whole end date (noon deal counted)
 */

function inRange(range: { start: Date; end: Date }, instant: Date): boolean {
  // The contract every consumer applies: start inclusive, end exclusive.
  return instant >= range.start && instant < range.end;
}

describe('resolveRange', () => {
  it('includes 11:59 PM on the selected end date and excludes the next day start', () => {
    const range = resolveRange({ startDate: '2026-06-01', endDate: '2026-06-15' });

    expect(range.start.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    // Exclusive next-day boundary — no -1ms comparisons.
    expect(range.end.toISOString()).toBe('2026-06-16T00:00:00.000Z');

    expect(inRange(range, new Date('2026-06-15T23:59:00.000Z'))).toBe(true);
    expect(inRange(range, new Date('2026-06-15T23:59:59.999Z'))).toBe(true);
    expect(inRange(range, new Date('2026-06-16T00:00:00.000Z'))).toBe(false);
  });

  it('treats startDate and endDate as whole covered days (same-day range is one full day)', () => {
    const range = resolveRange({ startDate: '2026-06-15', endDate: '2026-06-15' });
    expect(range.end.getTime() - range.start.getTime()).toBe(86_400_000);
    expect(inRange(range, new Date('2026-06-15T00:00:00.000Z'))).toBe(true);
    expect(inRange(range, new Date('2026-06-15T23:59:59.999Z'))).toBe(true);
    expect(inRange(range, new Date('2026-06-16T00:00:00.000Z'))).toBe(false);
  });

  describe('default range (deterministic — fixed UTC clock, no real system time)', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('ends at the current day boundary and does not include future dates', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-15T10:30:00.000Z'));

      const range = resolveRange({});

      // Default window: last 12 months, month-aligned start (2025-07-01).
      expect(range.start.toISOString()).toBe('2025-07-01T00:00:00.000Z');
      // End = the CURRENT day's exclusive boundary (tomorrow's UTC midnight),
      // day-aligned — the old default, now + 24h - 1s, never is.
      expect(range.end.toISOString()).toBe('2026-06-16T00:00:00.000Z');
      expect(range.end.getTime() % 86_400_000).toBe(0);
      // Ends at (at most) the next day boundary — not ~24h past "now".
      expect(range.end.getTime() - new Date('2026-06-15T10:30:00.000Z').getTime()).toBeLessThanOrEqual(86_400_000);

      // Now is inside the range; the exclusive boundary and beyond are not.
      expect(inRange(range, new Date('2026-06-15T10:30:00.000Z'))).toBe(true);
      expect(inRange(range, new Date('2026-06-15T23:59:59.999Z'))).toBe(true);
      expect(inRange(range, range.end)).toBe(false);
      expect(inRange(range, new Date('2026-06-17T12:00:00.000Z'))).toBe(false);
    });

    it('is stable at the last millisecond of the UTC day (no midnight flake)', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-15T23:59:59.999Z'));

      const range = resolveRange({});

      expect(range.start.toISOString()).toBe('2025-07-01T00:00:00.000Z');
      expect(range.end.toISOString()).toBe('2026-06-16T00:00:00.000Z');
      expect(inRange(range, new Date('2026-06-15T23:59:59.999Z'))).toBe(true);
      expect(inRange(range, range.end)).toBe(false);
    });

    it('rolls the 12-month default start across a year boundary', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-05T08:00:00.000Z'));

      const range = resolveRange({});

      expect(range.start.toISOString()).toBe('2025-02-01T00:00:00.000Z');
      expect(range.end.toISOString()).toBe('2026-01-06T00:00:00.000Z');
    });
  });

  it('rejects startDate later than endDate with BadRequestException (HTTP 400)', () => {
    let thrown: unknown;
    try {
      resolveRange({ startDate: '2026-06-16', endDate: '2026-06-15' });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(BadRequestException);
    expect((thrown as BadRequestException).getStatus()).toBe(400);
    expect((thrown as BadRequestException).message).toBe('startDate must be on or before endDate');
  });

  it('rejects unparsable dates with BadRequestException (HTTP 400)', () => {
    let thrown: unknown;
    try {
      resolveRange({ startDate: 'definitely-not-a-date' });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(BadRequestException);
    expect((thrown as BadRequestException).getStatus()).toBe(400);
  });

  it('rejects impossible calendar dates (2026-02-30) instead of silently rolling them over', () => {
    // `new Date('2026-02-30')` returns 2026-03-02 (JS normalises out-of-range
    // components), which would quietly shift the report window by days.
    for (const query of [
      { startDate: '2026-02-30', endDate: '2026-06-15' },
      { startDate: '2026-06-01', endDate: '2026-02-30' },
      { startDate: '2026-04-31', endDate: '2026-06-15' }, // April has 30 days
      { startDate: '2026-06-01', endDate: '2026-13-01' }, // month 13
      { startDate: '2026-06-01', endDate: '2026-02-30T10:00:00.000Z' }, // datetime rollover
      { startDate: '2026-06-01', endDate: '2026-06-15T25:00:00.000Z' }, // hour 25
      { startDate: '2026-06-01', endDate: '2026-06-15T12:00:00+25:00' }, // offset hour 25
    ]) {
      let thrown: unknown;
      try {
        resolveRange(query);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(BadRequestException);
      expect((thrown as BadRequestException).getStatus()).toBe(400);
      thrown = undefined;
    }
  });

  it('accepts leap day 2024-02-29 but rejects 2026-02-29 (non-leap year)', () => {
    expect(resolveRange({ startDate: '2024-02-29', endDate: '2024-03-01' }).start.toISOString()).toBe(
      '2024-02-29T00:00:00.000Z',
    );

    let thrown: unknown;
    try {
      resolveRange({ startDate: '2026-02-29', endDate: '2026-03-10' });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(BadRequestException);
    expect((thrown as BadRequestException).getStatus()).toBe(400);
  });
});

describe('CrmDashboardController (HTTP mapping)', () => {
  it('returns HTTP 400 when startDate is later than endDate', async () => {
    // resolveRange throws before any Prisma access, so no DB is needed here.
    const service = new CrmDashboardService({} as never);
    const workspaceAccess = { resolveForUser: jest.fn().mockResolvedValue({}) } as never;
    const enforcer = { requireModule: jest.fn() } as never;
    const controller = new CrmDashboardController(service, workspaceAccess, enforcer);
    const user = { id: 'user-1', email: 'owner@acme.com', role: 'MANAGER', organizationId: 'org-1' } as never;

    const error = await controller
      .getDashboard(user, { startDate: '2026-06-16', endDate: '2026-06-15' })
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getStatus()).toBe(400);
  });
});

describe('CrmDashboardService.getReports (date boundary behaviour)', () => {
  function makeDeal(id: string, wonAtIso: string, value: number) {
    const wonAt = new Date(wonAtIso);
    return {
      id,
      title: id,
      value,
      probability: 100,
      stageId: null,
      pipelineId: 'pipe-1',
      ownerId: null,
      owner: null,
      createdAt: new Date(wonAt.getTime() - 5 * 86_400_000),
      wonAt,
      lostAt: null,
      expectedCloseDate: null,
    };
  }

  const DEALS = [
    makeDeal('d-mid', '2026-06-10T09:00:00.000Z', 100),
    makeDeal('d-noon', '2026-06-15T12:00:00.000Z', 200), // noon on report + target end date
    makeDeal('d-2359', '2026-06-15T23:59:00.000Z', 300), // 11:59 PM on report end date
    makeDeal('d-next', '2026-06-16T00:00:00.000Z', 999), // exactly the next day's start
  ];

  const TARGET = {
    id: 'target-1',
    ownerId: null,
    owner: null,
    periodStart: new Date('2026-06-01T00:00:00.000Z'),
    periodEnd: new Date('2026-06-15T00:00:00.000Z'),
    amount: 600,
    notes: null,
  };

  function buildService() {
    const prisma = {
      pipeline: { findMany: jest.fn().mockResolvedValue([]) },
      deal: {
        findMany: jest.fn().mockResolvedValue(DEALS),
        count: jest.fn().mockResolvedValue(0),
      },
      dealStageHistory: { findMany: jest.fn().mockResolvedValue([]) },
      salesTarget: { findMany: jest.fn().mockResolvedValue([TARGET]) },
      lead: { count: jest.fn().mockResolvedValue(0) },
      contact: { count: jest.fn().mockResolvedValue(0) },
    };
    return { service: new CrmDashboardService(prisma as never), prisma };
  }

  it('counts a deal won at 11:59 PM on the report end date but not one at the next day start', async () => {
    const { service } = buildService();

    const report = await service.getReports('org-1', {
      startDate: '2026-06-01',
      endDate: '2026-06-15',
      granularity: 'day',
    });

    // 100 (Jun 10) + 200 (noon Jun 15) + 300 (23:59 Jun 15) = 600.
    // The 999 deal stamped exactly 2026-06-16T00:00:00Z must not be counted.
    expect(report.kpis.revenue).toBe(600);
    expect(report.kpis.wonCount).toBe(3);

    // Payload reports the last INCLUDED day — not a future timestamp.
    expect(report.range.startDate).toBe('2026-06-01T00:00:00.000Z');
    expect(report.range.endDate).toBe('2026-06-15T00:00:00.000Z');

    // Revenue trend ends on the last covered day (no empty trailing bucket)
    // and books the end-of-day revenue into that day.
    expect(report.revenueTrend.labels).not.toContain('2026-06-16');
    const lastLabel = report.revenueTrend.labels[report.revenueTrend.labels.length - 1];
    expect(lastLabel).toBe('2026-06-15');
    const lastIdx = report.revenueTrend.labels.indexOf('2026-06-15');
    expect(report.revenueTrend.revenue[lastIdx]).toBe(500); // noon + 23:59
  });

  it('includes a deal won at noon on the target end date in target achievement, excluding the next day start', async () => {
    const { service, prisma } = buildService();

    const report = await service.getReports('org-1', { startDate: '2026-06-01', endDate: '2026-06-15' });

    // Target period Jun 1 – Jun 15: achieved = 100 + 200 (noon) + 300 (23:59)
    // = 600 of 600; the Jun 16T00:00 deal (999) is outside the period.
    expect(report.targets).toHaveLength(1);
    expect(report.targets[0].achieved).toBe(600);
    expect(report.targets[0].achievement).toBe(100);

    // Sales-target overlap query uses the exclusive next-day bound so a target
    // starting on the last covered day still overlaps the range.
    expect(prisma.salesTarget.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          periodStart: { lt: new Date('2026-06-16T00:00:00.000Z') },
          periodEnd: { gte: new Date('2026-06-01T00:00:00.000Z') },
        }),
      }),
    );
  });

  it('computes target achievement with exact decimal accumulation (0.1 + 0.2 = 0.3)', async () => {
    const prisma = {
      pipeline: { findMany: jest.fn().mockResolvedValue([]) },
      deal: {
        findMany: jest.fn().mockResolvedValue([
          makeDeal('d-a', '2026-06-10T09:00:00.000Z', 0.1),
          makeDeal('d-b', '2026-06-11T09:00:00.000Z', 0.2),
        ]),
        count: jest.fn().mockResolvedValue(0),
      },
      dealStageHistory: { findMany: jest.fn().mockResolvedValue([]) },
      salesTarget: { findMany: jest.fn().mockResolvedValue([{ ...TARGET, amount: 1 }]) },
      lead: { count: jest.fn().mockResolvedValue(0) },
      contact: { count: jest.fn().mockResolvedValue(0) },
    };
    const service = new CrmDashboardService(prisma as never);

    const report = await service.getReports('org-1', { startDate: '2026-06-01', endDate: '2026-06-15' });

    // Strict equality — must be 0.3, never 0.30000000000000004.
    expect(report.targets[0].achieved).toBe(0.3);
    expect(report.kpis.targetAmount).toBe(1);
    expect(report.kpis.targetAchievement).toBe(30); // 0.3 / 1 → 30%
  });

  it('sums raw Prisma.Decimal row values exactly, excluding out-of-period deals', async () => {
    const prisma = {
      pipeline: { findMany: jest.fn().mockResolvedValue([]) },
      deal: {
        findMany: jest.fn().mockResolvedValue([
          // Production-shaped rows: Prisma returns Decimal values, exactly
          // what SalesTargetService sums with `sum.plus(d.value)`.
          { ...makeDeal('d-1', '2026-06-10T09:00:00.000Z', 0.1), value: new Prisma.Decimal('0.1') },
          { ...makeDeal('d-2', '2026-06-11T09:00:00.000Z', 0.2), value: new Prisma.Decimal('0.2') },
          { ...makeDeal('d-3', '2026-06-12T09:00:00.000Z', 0.3), value: new Prisma.Decimal('0.3') },
          // Won Jul 1 — outside BOTH the report range and the target period.
          { ...makeDeal('d-4', '2026-07-01T00:00:00.000Z', 0.4), value: new Prisma.Decimal('0.4') },
        ]),
        count: jest.fn().mockResolvedValue(0),
      },
      dealStageHistory: { findMany: jest.fn().mockResolvedValue([]) },
      salesTarget: { findMany: jest.fn().mockResolvedValue([{ ...TARGET, amount: 10 }]) },
      lead: { count: jest.fn().mockResolvedValue(0) },
      contact: { count: jest.fn().mockResolvedValue(0) },
    };
    const service = new CrmDashboardService(prisma as never);

    const report = await service.getReports('org-1', { startDate: '2026-06-01', endDate: '2026-06-15' });

    // 0.1 + 0.2 + 0.3 exactly (plain float chain would be 0.6000000000000001);
    // the 0.4 deal is excluded by both period predicates.
    expect(report.targets[0].achieved).toBe(0.6);
    expect(report.kpis.targetAchievement).toBe(6); // 0.6 / 10 → 6%
  });
});

describe('QueryCrmReportsDto (ValidationPipe contract — strict calendar dates)', () => {
  it('accepts the real-date formats clients send', async () => {
    const accepted = [
      '2026-06-01', // date-only
      '2026-06-01T12:00:00.000Z', // datetime with Z
      '2024-02-29', // valid leap day
      '2000-02-29', // divisible-by-400 leap day
      '2026-06-15T12:00:00+05:30', // positive timezone offset
      '2026-06-15T12:00:00-08:00', // negative timezone offset
      '2026-06-15T12:00:00+0530', // offset without colon
    ];
    for (const startDate of accepted) {
      const dto = plainToInstance(QueryCrmReportsDto, { startDate, endDate: '2026-06-15' });
      expect(await validate(dto)).toHaveLength(0);
    }
  });

  it('rejects impossible calendar dates at the pipe (before any service runs)', async () => {
    // Previously `@IsDateString()` accepted all of these; 2026-02-30 would
    // then silently become 2026-03-02 via `new Date()`.
    const rejected = [
      '2026-02-30', // invalid month length (Feb 30)
      '2026-02-29', // non-leap year
      '1900-02-29', // divisible-by-100 century is NOT a leap year
      '2026-04-31', // April has 30 days
      '2026-06-31', // June has 30 days
      '2026-13-01', // month 13
      '2026-02-30T10:00:00.000Z', // impossible date inside a datetime string
      '2026-06-15T25:00:00.000Z', // hour 25
      '2026-06-15T12:60:00.000Z', // minute 60
      '2026-06-15T12:00:60.000Z', // second 60
      '2026-06-15T12:00:00+25:00', // timezone offset hour 25
      '2026-06-15T12:00:00+05:60', // timezone offset minute 60
      'not-a-date',
    ];
    for (const startDate of rejected) {
      const dto = plainToInstance(QueryCrmReportsDto, { startDate });
      const errors = await validate(dto);
      expect(errors.find((e) => e.property === 'startDate')).toBeDefined();
    }

    const badEnd = plainToInstance(QueryCrmReportsDto, { endDate: '2026-02-30' });
    expect((await validate(badEnd)).find((e) => e.property === 'endDate')).toBeDefined();
  });
});
