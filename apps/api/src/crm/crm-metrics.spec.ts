import {
  buildBuckets,
  computeFunnel,
  computeRevenueTrend,
  startOfNextUtcDay,
  type MetricDeal,
  type MetricStage,
  type StageReach,
} from './crm-metrics';

const stages: MetricStage[] = [
  { id: 'st-new', name: 'New', position: 1, isWon: false, isLost: false },
  { id: 'st-qual', name: 'Qualified', position: 2, isWon: false, isLost: false },
  { id: 'st-won', name: 'Won', position: 3, isWon: true, isLost: false },
];

function makeDeal(overrides: Partial<MetricDeal> & { id: string }): MetricDeal {
  return {
    value: 100,
    probability: 50,
    stageId: null,
    ownerId: null,
    createdAt: new Date('2026-01-01'),
    wonAt: null,
    lostAt: null,
    expectedCloseDate: null,
    ...overrides,
  };
}

describe('computeFunnel (count/value consistency)', () => {
  it('value covers exactly the same distinct deals as dealCount for every stage', () => {
    const deals = [
      makeDeal({ id: 'd1', stageId: 'st-new', value: 100 }),
      makeDeal({ id: 'd2', stageId: 'st-qual', value: 200 }),
      makeDeal({ id: 'd3', stageId: 'st-won', value: 300 }),
    ];

    const funnel = computeFunnel(stages, deals, []);

    expect(funnel).toHaveLength(3);
    for (const row of funnel) {
      // No history here: reached set == current membership per stage, so the
      // per-stage deal total must equal value summed over that same set.
      const expectedValue = deals
        .filter((d) => d.stageId === row.stageId)
        .reduce((sum, d) => sum + d.value, 0);
      expect(row.dealCount).toBe(deals.filter((d) => d.stageId === row.stageId).length);
      expect(row.value).toBe(expectedValue);
    }
  });

  it('a deal that advanced still contributes its value to earlier stages (reached semantics)', () => {
    // d1 moved New -> Qualified -> Won; history records both transitions.
    const deals = [makeDeal({ id: 'd1', stageId: 'st-won', value: 500 })];
    const reach: StageReach[] = [
      { dealId: 'd1', stageId: 'st-new' },
      { dealId: 'd1', stageId: 'st-qual' },
      { dealId: 'd1', stageId: 'st-won' },
    ];

    const funnel = computeFunnel(stages, deals, reach);

    // Before the fix, value used only current membership: New and Qualified
    // showed dealCount 1 but value 0.
    expect(funnel[0].dealCount).toBe(1);
    expect(funnel[0].value).toBe(500);
    expect(funnel[1].dealCount).toBe(1);
    expect(funnel[1].value).toBe(500);
    expect(funnel[2].dealCount).toBe(1);
    expect(funnel[2].value).toBe(500);
  });

  it('value never double-counts a deal that appears in both current stage and history', () => {
    const deals = [makeDeal({ id: 'd1', stageId: 'st-qual', value: 250 })];
    const reach: StageReach[] = [
      { dealId: 'd1', stageId: 'st-new' },
      { dealId: 'd1', stageId: 'st-qual' },
    ];

    const funnel = computeFunnel(stages, deals, reach);

    const qualified = funnel.find((f) => f.stageId === 'st-qual');
    expect(qualified?.dealCount).toBe(1);
    expect(qualified?.value).toBe(250);
  });

  it('history-only deals count in dealCount and contribute their known value', () => {
    const deals = [
      makeDeal({ id: 'd1', stageId: 'st-won', value: 100 }),
      // d2 no longer appears in the deal rows for the current stage (e.g. its
      // stageId is null) but its transition into New was recorded.
      makeDeal({ id: 'd2', stageId: null, value: 40 }),
    ];
    const reach: StageReach[] = [{ dealId: 'd2', stageId: 'st-new' }];

    const funnel = computeFunnel(stages, deals, reach);

    const fresh = funnel.find((f) => f.stageId === 'st-new');
    expect(fresh?.dealCount).toBe(1);
    expect(fresh?.value).toBe(40);
  });

  it('rounds value to two decimals', () => {
    const deals = [
      makeDeal({ id: 'd1', stageId: 'st-new', value: 10.005 }),
      makeDeal({ id: 'd2', stageId: 'st-new', value: 20.004 }),
    ];

    const funnel = computeFunnel(stages, deals, []);

    expect(funnel[0].value).toBe(30.01);
  });
});

describe('startOfNextUtcDay', () => {
  it('returns the next UTC midnight regardless of time-of-day on the input', () => {
    expect(startOfNextUtcDay(new Date('2026-06-15T00:00:00.000Z')).toISOString()).toBe('2026-06-16T00:00:00.000Z');
    expect(startOfNextUtcDay(new Date('2026-06-15T12:34:56.789Z')).toISOString()).toBe('2026-06-16T00:00:00.000Z');
    expect(startOfNextUtcDay(new Date('2026-06-15T23:59:59.999Z')).toISOString()).toBe('2026-06-16T00:00:00.000Z');
    // Month/year rollover included.
    expect(startOfNextUtcDay(new Date('2026-12-31T08:00:00.000Z')).toISOString()).toBe('2027-01-01T00:00:00.000Z');
    expect(startOfNextUtcDay(new Date('2026-02-28T10:00:00.000Z')).toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });
});

describe('computeRevenueTrend (exclusive range.end)', () => {
  const range = {
    start: new Date('2026-06-01T00:00:00.000Z'),
    end: new Date('2026-06-16T00:00:00.000Z'), // exclusive: covers through Jun 15
  };

  it('books a deal won at 11:59 PM on the last covered day into that day', () => {
    const deals = [makeDeal({ id: 'd1', wonAt: new Date('2026-06-15T23:59:00.000Z'), value: 300 })];

    const trend = computeRevenueTrend(deals, range, 'day');

    const idx = trend.labels.indexOf('2026-06-15');
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(trend.revenue[idx]).toBe(300);
    expect(trend.deals[idx]).toBe(1);
  });

  it('excludes a deal stamped exactly at the exclusive end boundary', () => {
    const deals = [
      makeDeal({ id: 'd1', wonAt: new Date('2026-06-16T00:00:00.000Z'), value: 999 }),
      makeDeal({ id: 'd2', wonAt: new Date('2026-06-15T12:00:00.000Z'), value: 100 }),
    ];

    const trend = computeRevenueTrend(deals, range, 'day');

    const total = trend.revenue.reduce((sum, v) => sum + v, 0);
    expect(total).toBe(100); // 999 at Jun 16T00:00 must not be counted
  });

  it('does not emit an empty trailing bucket beyond the last covered day', () => {
    const trend = computeRevenueTrend([], range, 'day');

    // Exclusive end = Jun 16 00:00 → buckets must stop at Jun 15, not Jun 16.
    expect(trend.labels).not.toContain('2026-06-16');
    expect(trend.labels[trend.labels.length - 1]).toBe('2026-06-15');
    expect(trend.labels[0]).toBe('2026-06-01');
    expect(trend.revenue.every((v) => v === 0)).toBe(true);
    expect(trend.revenue).toHaveLength(trend.labels.length);
    expect(trend.deals).toHaveLength(trend.labels.length);
  });

  it('month granularity ends at the bucket covering the last covered day', () => {
    const monthRange = {
      start: new Date('2026-05-15T00:00:00.000Z'),
      end: new Date('2026-06-16T00:00:00.000Z'), // exclusive, covers through Jun 15
    };
    const deals = [makeDeal({ id: 'd1', wonAt: new Date('2026-06-15T23:59:00.000Z'), value: 50 })];

    const trend = computeRevenueTrend(deals, monthRange, 'month');

    expect(trend.labels).toEqual(['2026-05', '2026-06']);
    expect(trend.revenue).toEqual([0, 50]);
  });
});

describe('buildBuckets (exclusive range end contract)', () => {
  const DAY = 86_400_000;
  const start = new Date('2026-06-01T00:00:00.000Z');

  it('creates NO extra bucket when range.end is an exclusive next-day boundary', () => {
    const buckets = buildBuckets({ start, end: new Date('2026-06-16T00:00:00.000Z') }, 'day');

    // [Jun 1, Jun 16) covers Jun 1..Jun 15 = 15 buckets, no trailing Jun 16.
    expect(buckets).toHaveLength(15);
    expect(buckets[buckets.length - 1].toISOString()).toBe('2026-06-15T00:00:00.000Z');
    expect(buckets.map((d) => d.toISOString().slice(0, 10))).not.toContain('2026-06-16');
    expect(buckets[0].toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('produces byte-identical buckets for an inclusive 23:59:59.999 end', () => {
    const exclusive = buildBuckets({ start, end: new Date('2026-06-16T00:00:00.000Z') }, 'day');
    const inclusive = buildBuckets({ start, end: new Date('2026-06-15T23:59:59.999Z') }, 'day');

    expect(inclusive).toEqual(exclusive);
  });

  it('honours exclusive ends for week and month granularity too', () => {
    // Week buckets are Monday-anchored: [Mon Jun 8, Mon Jun 15) = one bucket.
    const weeks = buildBuckets(
      { start: new Date('2026-06-08T00:00:00.000Z'), end: new Date('2026-06-15T00:00:00.000Z') },
      'week',
    );
    expect(weeks.map((d) => d.toISOString().slice(0, 10))).toEqual(['2026-06-08']);

    // [Jun 1, Jul 1) covers June only — no trailing July bucket.
    const months = buildBuckets(
      { start: new Date('2026-06-01T00:00:00.000Z'), end: new Date('2026-07-01T00:00:00.000Z') },
      'month',
    );
    expect(months.map((d) => d.toISOString().slice(0, 7))).toEqual(['2026-06']);
  });

  it('returns an empty list for a zero-length exclusive range instead of looping', () => {
    const empty = new Date('2026-06-01T00:00:00.000Z');
    expect(buildBuckets({ start: empty, end: new Date(empty.getTime()) }, 'day')).toHaveLength(0);
    expect(buildBuckets({ start: empty, end: new Date(empty.getTime() - DAY) }, 'day')).toHaveLength(0);
  });

  it('day buckets advance exactly one day at a time across the range', () => {
    const buckets = buildBuckets({ start, end: new Date('2026-06-04T00:00:00.000Z') }, 'day');
    expect(buckets.map((d) => d.getTime())).toEqual([
      start.getTime(),
      start.getTime() + DAY,
      start.getTime() + 2 * DAY,
    ]);
  });
});
