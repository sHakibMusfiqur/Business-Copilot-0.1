import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { SalesTargetService } from './sales-target.service';
import { CreateSalesTargetDto } from './dto/create-sales-target.dto';
import { UpdateSalesTargetDto } from './dto/update-sales-target.dto';
import { QuerySalesTargetsDto } from './dto/query-sales-targets.dto';

/**
 * Regression tests for Sales Target period date semantics:
 * - periodEnd is day-scoped: a target ending on a date covers that whole date
 *   (a deal won at noon — or 23:59 — on the end date is counted).
 * - a deal won exactly at the next day's start is excluded (exclusive
 *   next-day boundary instead of <= midnight / -1ms comparisons).
 * - invalid dates surface as BadRequestException (HTTP 400).
 * - findAll, findById and CrmDashboardService apply the SAME boundary.
 */

const PERIOD_START = new Date('2026-06-01T00:00:00.000Z');
const PERIOD_END = new Date('2026-06-15T00:00:00.000Z');
const END_EXCLUSIVE = new Date('2026-06-16T00:00:00.000Z');

const TARGET_ROW = {
  id: 'target-1',
  ownerId: null,
  owner: null,
  periodStart: PERIOD_START,
  periodEnd: PERIOD_END,
  amount: 600,
  notes: null,
  createdAt: new Date('2026-05-30T00:00:00.000Z'),
  updatedAt: new Date('2026-05-30T00:00:00.000Z'),
};

function buildService() {
  const prisma = {
    salesTarget: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    deal: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    user: { findFirst: jest.fn() },
  };
  return { service: new SalesTargetService(prisma as never), prisma };
}

describe('SalesTargetService.findAll (periodEnd covers the whole end date)', () => {
  it('counts a deal won at noon on the end date and excludes one at the next day start', async () => {
    const { service, prisma } = buildService();
    prisma.salesTarget.findMany.mockResolvedValue([TARGET_ROW]);
    prisma.deal.findMany.mockResolvedValue([
      { value: 100, ownerId: null, wonAt: new Date('2026-06-14T09:00:00.000Z') },
      { value: 200, ownerId: null, wonAt: new Date('2026-06-15T12:00:00.000Z') }, // noon on end date
      { value: 999, ownerId: null, wonAt: new Date('2026-06-16T00:00:00.000Z') }, // next day start
    ]);

    const result = await service.findAll('org-1', {} as never);

    // The fetch window must reach through the entire end day (exclusive
    // next-day boundary), not stop at periodEnd midnight.
    expect(prisma.deal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          wonAt: { gte: PERIOD_START, lt: END_EXCLUSIVE },
        }),
      }),
    );

    // Behaviour: 100 + 200 (noon) counted; 999 at exactly Jun 16T00:00 is not.
    expect(result.data).toHaveLength(1);
    expect(result.data[0].achieved).toBe(300);
    expect(result.data[0].wonCount).toBe(2);
    expect(result.data[0].achievement).toBe(50); // 300 of 600
  });

  it('applies day-scoped from/to overlap filters for the target list', async () => {
    const { service, prisma } = buildService();
    prisma.salesTarget.findMany.mockResolvedValue([]);
    prisma.deal.findMany.mockResolvedValue([]);

    await service.findAll('org-1', { from: '2026-06-01', to: '2026-06-15' } as never);

    expect(prisma.salesTarget.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          // A target ending on `from` day overlaps it; a target starting any
          // time on `to` day overlaps it.
          periodEnd: { gte: new Date('2026-06-01T00:00:00.000Z') },
          periodStart: { lt: END_EXCLUSIVE },
        }),
      }),
    );
  });

  it('treats periodStart as an inclusive lower bound: the whole UTC start date counts', async () => {
    const { service, prisma } = buildService();
    prisma.salesTarget.findMany.mockResolvedValue([TARGET_ROW]);
    prisma.deal.findMany.mockResolvedValue([
      { value: 50, ownerId: null, wonAt: new Date('2026-05-31T23:59:59.999Z') }, // before period
      { value: 75, ownerId: null, wonAt: new Date('2026-06-01T00:00:00.000Z') }, // exactly periodStart
      { value: 25, ownerId: null, wonAt: new Date('2026-06-01T13:00:00.000Z') }, // midday on start date
    ]);

    const result = await service.findAll('org-1', {} as never);

    // Verified business rule (UNCHANGED): periodStart is compared as an exact
    // instant; for date-only periods stored at 00:00 UTC (what the UI sends)
    // that makes the entire start date inclusive, while the millisecond
    // before the period stays excluded.
    expect(result.data[0].achieved).toBe(100);
    expect(result.data[0].wonCount).toBe(2);
  });

  it('rejects impossible from/to calendar dates with HTTP 400 instead of feeding Prisma a rolled-over day', async () => {
    const { service, prisma } = buildService();

    for (const query of [{ from: '2026-02-30' }, { to: '2026-04-31' }, { to: 'not-a-date' }]) {
      const error = await service.findAll('org-1', query as never).catch((err: unknown) => err);
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getStatus()).toBe(400);
    }
    expect(prisma.salesTarget.findMany).not.toHaveBeenCalled();
  });
});

describe('SalesTargetService.findById (same boundary as findAll)', () => {
  it('queries with the exclusive next-day boundary so end-of-day wins are counted', async () => {
    const { service, prisma } = buildService();
    prisma.salesTarget.findFirst.mockResolvedValue(TARGET_ROW);
    prisma.deal.aggregate.mockResolvedValue({ _sum: { value: 300 }, _count: { id: 2 } });

    const result = await service.findById('org-1', 'target-1');

    expect(prisma.deal.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          wonAt: { gte: PERIOD_START, lt: END_EXCLUSIVE },
        }),
      }),
    );
    expect(result.achieved).toBe(300);
    expect(result.wonCount).toBe(2);
  });
});

describe('SalesTargetService.create/update (invalid dates → HTTP 400)', () => {
  it('create rejects an unparsable periodStart with BadRequestException', async () => {
    const { service, prisma } = buildService();

    const error = await service
      .create('org-1', 'user-1', { periodStart: 'not-a-date', periodEnd: '2026-06-15', amount: 100 } as never)
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getStatus()).toBe(400);
    expect(prisma.salesTarget.create).not.toHaveBeenCalled();
  });

  it('create still rejects periodStart after periodEnd with BadRequestException', async () => {
    const { service, prisma } = buildService();

    const error = await service
      .create('org-1', 'user-1', {
        periodStart: '2026-06-16T00:00:00.000Z',
        periodEnd: '2026-06-15T00:00:00.000Z',
        amount: 100,
      } as never)
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getStatus()).toBe(400);
    expect(prisma.salesTarget.create).not.toHaveBeenCalled();
  });

  it('create stores the provided period dates unchanged (no silent rewrite)', async () => {
    const { service, prisma } = buildService();
    prisma.salesTarget.create.mockResolvedValue({ ...TARGET_ROW, amount: 100 });

    await service.create('org-1', 'user-1', {
      periodStart: '2026-06-01T00:00:00.000Z',
      periodEnd: '2026-06-15T00:00:00.000Z',
      amount: 100,
    });

    expect(prisma.salesTarget.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          periodStart: new Date('2026-06-01T00:00:00.000Z'),
          periodEnd: new Date('2026-06-15T00:00:00.000Z'),
        }),
      }),
    );
  });

  it('update rejects an unparsable periodEnd with BadRequestException instead of writing an invalid date', async () => {
    const { service, prisma } = buildService();
    prisma.salesTarget.findFirst.mockResolvedValue({
      id: 'target-1',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      ownerId: null,
    });

    const error = await service
      .update('org-1', 'user-1', 'target-1', { periodEnd: 'garbage' } as never)
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getStatus()).toBe(400);
    expect(prisma.salesTarget.update).not.toHaveBeenCalled();
  });

  it('create rejects 2026-02-30 in periodStart/periodEnd — no silent roll-over to 2026-03-02', async () => {
    const { service, prisma } = buildService();

    // `new Date('2026-02-30')` === 2026-03-02: previously this passed the
    // NaN guard and would have been STORED as a March period.
    for (const payload of [
      { periodStart: '2026-02-30', periodEnd: '2026-03-31', amount: 100 },
      { periodStart: '2026-03-01', periodEnd: '2026-02-30', amount: 100 },
    ]) {
      const error = await service.create('org-1', 'user-1', payload as never).catch((err: unknown) => err);
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getStatus()).toBe(400);
    }
    expect(prisma.salesTarget.create).not.toHaveBeenCalled();
  });

  it('update rejects an impossible calendar date periodEnd instead of writing the rolled-over day', async () => {
    const { service, prisma } = buildService();
    prisma.salesTarget.findFirst.mockResolvedValue({
      id: 'target-1',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      ownerId: null,
    });

    const error = await service
      .update('org-1', 'user-1', 'target-1', { periodEnd: '2026-02-30' } as never)
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getStatus()).toBe(400);
    expect(prisma.salesTarget.update).not.toHaveBeenCalled();
  });
});

describe('Sales target DTOs (ValidationPipe contract — strict calendar dates)', () => {
  it('CreateSalesTargetDto accepts the real-date formats clients send', async () => {
    const accepted = [
      '2026-06-01', // date-only (what the UI sends)
      '2026-06-01T00:00:00.000Z', // toISOString() datetime
      '2024-02-29T00:00:00.000Z', // valid leap day as datetime
      '2026-06-15T12:00:00+05:30', // positive timezone offset
      '2026-06-15T12:00:00-08:00', // negative timezone offset
    ];
    for (const periodStart of accepted) {
      const dto = plainToInstance(CreateSalesTargetDto, {
        periodStart,
        periodEnd: '2026-06-15',
        amount: 100,
      });
      expect(await validate(dto)).toHaveLength(0);
    }
  });

  it('CreateSalesTargetDto rejects invalid datetime strings, leap mistakes and bad offsets', async () => {
    const rejected = [
      '2026-02-30T10:00:00.000Z', // impossible date inside a datetime
      '1900-02-29', // century non-leap day
      '2026-06-15T12:00:00+25:00', // timezone offset hour 25
      '2026-06-15T12:60:00.000Z', // minute 60
    ];
    for (const periodStart of rejected) {
      const dto = plainToInstance(CreateSalesTargetDto, {
        periodStart,
        periodEnd: '2026-06-15',
        amount: 100,
      });
      expect((await validate(dto)).find((e) => e.property === 'periodStart')).toBeDefined();
    }

    const badEnd = plainToInstance(CreateSalesTargetDto, {
      periodStart: '2026-06-01',
      periodEnd: '2026-02-30T10:00:00.000Z',
      amount: 100,
    });
    expect((await validate(badEnd)).find((e) => e.property === 'periodEnd')).toBeDefined();
  });

  it('CreateSalesTargetDto rejects impossible calendar dates in both period fields', async () => {
    const badStart = plainToInstance(CreateSalesTargetDto, {
      periodStart: '2026-02-30',
      periodEnd: '2026-06-15',
      amount: 100,
    });
    expect((await validate(badStart)).find((e) => e.property === 'periodStart')).toBeDefined();

    const badEnd = plainToInstance(CreateSalesTargetDto, {
      periodStart: '2026-06-01',
      periodEnd: '2026-04-31',
      amount: 100,
    });
    expect((await validate(badEnd)).find((e) => e.property === 'periodEnd')).toBeDefined();
  });

  it('UpdateSalesTargetDto and QuerySalesTargetsDto reject impossible calendar dates', async () => {
    const update = plainToInstance(UpdateSalesTargetDto, { periodEnd: '2026-02-30' });
    expect((await validate(update)).find((e) => e.property === 'periodEnd')).toBeDefined();

    const fromQuery = plainToInstance(QuerySalesTargetsDto, { from: '2026-02-30' });
    expect((await validate(fromQuery)).find((e) => e.property === 'from')).toBeDefined();

    const toQuery = plainToInstance(QuerySalesTargetsDto, { to: '2026-02-29' }); // non-leap 2026
    expect((await validate(toQuery)).find((e) => e.property === 'to')).toBeDefined();
  });
});
