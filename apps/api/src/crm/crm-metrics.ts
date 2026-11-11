import { isISO8601 } from 'class-validator';

export type Granularity = 'day' | 'week' | 'month';

export interface MetricDeal {
  id: string;
  value: number;
  probability: number;
  stageId: string | null;
  ownerId: string | null;
  createdAt: Date;
  wonAt: Date | null;
  lostAt: Date | null;
  expectedCloseDate: Date | null;
}

export interface MetricStage {
  id: string;
  name: string;
  position: number;
  isWon: boolean;
  isLost: boolean;
}

export interface StageReach {
  dealId: string;
  stageId: string;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Parses an ISO date/datetime string with STRICT calendar validation and
 * returns null when the value is not a real date.
 *
 * Plain `new Date('2026-02-30')` silently rolls the date over to 2026-03-02
 * (JavaScript normalises out-of-range components instead of failing), and
 * class-validator's `@IsDateString()` accepts such strings — so an invalid
 * date could previously reach Prisma/reporting as a different, "valid" day.
 * `isISO8601(..., { strict: true })` rejects impossible calendar dates
 * (2026-02-30, 2026-02-29 in a non-leap year, 2026-04-31, month 13, garbage)
 * while accepting every format `@IsDateString()` accepted for real dates
 * (date-only, datetime with/without offset, space separator).
 */
export function parseStrictIsoDate(value: string): Date | null {
  if (!isISO8601(value, { strict: true })) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Exclusive day boundary: 00:00:00.000 UTC of the day AFTER the given date's
 * UTC day. Used so a range/end date that covers "through the entire day" can
 * be expressed as `timestamp < startOfNextUtcDay(day)` — a next-day boundary
 * instead of fragile `<= 23:59:59.999` millisecond comparisons.
 */
export function startOfNextUtcDay(date: Date): Date {
  const d = startOfDay(date);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function bucketStart(date: Date, granularity: Granularity): Date {
  const d = startOfDay(date);
  if (granularity === 'month') {
    d.setUTCDate(1);
    return d;
  }
  if (granularity === 'week') {
    const weekday = d.getUTCDay();
    const offset = (weekday + 6) % 7;
    d.setUTCDate(d.getUTCDate() - offset);
    return d;
  }
  return d;
}

export function bucketLabel(date: Date, granularity: Granularity): string {
  if (granularity === 'month') return date.toISOString().slice(0, 7);
  return date.toISOString().slice(0, 10);
}

/**
 * Builds the aligned bucket starts covering `[range.start, range.end)`.
 *
 * Contract:
 * - `range.end` is EXCLUSIVE: the range covers every instant from `start` up
 *   to (not including) `end`. When `end` sits on a bucket boundary — e.g.
 *   `2026-06-16T00:00:00Z` for day granularity — NO bucket is emitted for the
 *   end day, so an exclusive range never gets an empty trailing bucket.
 * - An INCLUSIVE end (`23:59:59.999` of the last covered day) yields
 *   byte-identical buckets: only the end's UTC day/week/month matters, and
 *   the 1 ms probe stays inside that same bucket.
 * - The first bucket is `bucketStart(range.start)`; buckets then advance by
 *   day / week (Monday) / month in UTC. Returns `[]` when the exclusive range
 *   covers nothing (`end <= start`).
 *
 * Caller audit (checked before this contract was fixed): the only caller
 * anywhere in the repo is `computeRevenueTrend`, which previously
 * pre-subtracted 1 ms from `range.end` to avoid the trailing bucket; it now
 * passes its exclusive range through unchanged. No other production or test
 * code calls `buildBuckets`.
 */
export function buildBuckets(range: DateRange, granularity: Granularity): Date[] {
  const buckets: Date[] = [];
  const cursor = bucketStart(range.start, granularity);
  // Probe the LAST MILLISECOND the exclusive range actually covers, so an
  // end at 00:00 sharp never contributes its own (empty) bucket.
  const last = bucketStart(new Date(range.end.getTime() - 1), granularity);

  while (cursor <= last) {
    buckets.push(new Date(cursor));
    if (granularity === 'month') cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else if (granularity === 'week') cursor.setUTCDate(cursor.getUTCDate() + 7);
    else cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return buckets;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function percentage(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

/**
 * Buckets won deals into the revenue trend.
 *
 * `range.end` is an EXCLUSIVE boundary (next-day start); `buildBuckets`
 * honours that contract, so a date-scoped range like [Jun 1, Jun 16) ends at
 * the Jun 15 bucket instead of producing an empty trailing Jun 16 bucket.
 */
export function computeRevenueTrend(
  wonDeals: MetricDeal[],
  range: DateRange,
  granularity: Granularity,
): { labels: string[]; revenue: number[]; deals: number[] } {
  const buckets = buildBuckets(range, granularity);
  const index = new Map<string, number>();
  buckets.forEach((bucket, i) => index.set(bucket.toISOString().slice(0, 10), i));

  const revenue = buckets.map(() => 0);
  const counts = buckets.map(() => 0);

  for (const deal of wonDeals) {
    if (!deal.wonAt) continue;
    // range.end is exclusive: a deal stamped exactly at the boundary belongs
    // to the next range, not this one.
    if (deal.wonAt < range.start || deal.wonAt >= range.end) continue;
    const key = bucketStart(deal.wonAt, granularity).toISOString().slice(0, 10);
    const i = index.get(key);
    if (i === undefined) continue;
    revenue[i] += deal.value;
    counts[i] += 1;
  }

  return {
    labels: buckets.map((bucket) => bucketLabel(bucket, granularity)),
    revenue: revenue.map(round2),
    deals: counts,
  };
}

/**
 * Counts distinct deals that reached each stage, using current stage membership
 * plus recorded stage transitions so a deal that already advanced still shows
 * in the funnel of earlier stages. `value` sums those same distinct deals, so
 * count and value always describe the identical "reached" set.
 */
export function computeFunnel(
  stages: MetricStage[],
  deals: MetricDeal[],
  reach: StageReach[],
): Array<{
  stageId: string;
  name: string;
  position: number;
  dealCount: number;
  value: number;
  conversionFromPrevious: number;
}> {
  const reached = new Map<string, Set<string>>();
  const dealValue = new Map<string, number>();

  for (const stage of stages) reached.set(stage.id, new Set());

  for (const deal of deals) {
    dealValue.set(deal.id, deal.value);
    if (!deal.stageId) continue;
    reached.get(deal.stageId)?.add(deal.id);
  }

  for (const entry of reach) {
    reached.get(entry.stageId)?.add(entry.dealId);
  }

  const valueByStage = new Map<string, number>();
  for (const stage of stages) {
    let sum = 0;
    for (const dealId of reached.get(stage.id) ?? []) {
      sum += dealValue.get(dealId) ?? 0;
    }
    valueByStage.set(stage.id, round2(sum));
  }

  return stages.map((stage, i) => {
    const count = reached.get(stage.id)?.size ?? 0;
    const previous = i === 0 ? null : (reached.get(stages[i - 1].id)?.size ?? 0);
    return {
      stageId: stage.id,
      name: stage.name,
      position: stage.position,
      dealCount: count,
      value: valueByStage.get(stage.id) ?? 0,
      conversionFromPrevious: i === 0 ? 100 : percentage(count, previous ?? 0),
    };
  });
}

export function computeSalesCycle(wonDeals: MetricDeal[]): {
  averageDays: number;
  medianDays: number;
  sampleSize: number;
} {
  const durations = wonDeals
    .map((deal) =>
      deal.wonAt ? (deal.wonAt.getTime() - deal.createdAt.getTime()) / 86_400_000 : null,
    )
    .filter((days): days is number => days !== null && Number.isFinite(days) && days >= 0)
    .sort((a, b) => a - b);

  if (durations.length === 0) {
    return { averageDays: 0, medianDays: 0, sampleSize: 0 };
  }

  const sum = durations.reduce((acc, days) => acc + days, 0);
  const middle = Math.floor(durations.length / 2);
  const median =
    durations.length % 2 === 0
      ? (durations[middle - 1] + durations[middle]) / 2
      : durations[middle];

  return {
    averageDays: round2(sum / durations.length),
    medianDays: round2(median),
    sampleSize: durations.length,
  };
}

export function stageProbability(
  position: number,
  maxPosition: number,
  isWon: boolean,
  isLost: boolean,
): number {
  if (isWon) return 100;
  if (isLost) return 0;
  if (maxPosition <= 0) return 50;
  const ratio = (position + 1) / maxPosition;
  return Math.min(95, Math.max(5, Math.round(ratio * 100)));
}
