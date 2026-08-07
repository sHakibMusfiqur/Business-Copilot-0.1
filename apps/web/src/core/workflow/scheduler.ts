import { toUnixSeconds } from '../utils/dates';

/** Fields parsed from a standard five-field cron expression. */
export interface CronParts {
  readonly minute: readonly number[];
  readonly hour: readonly number[];
  readonly dayOfMonth: readonly number[];
  readonly month: readonly number[];
  readonly dayOfWeek: readonly number[];
}

/** Errors thrown when a cron expression cannot be parsed. */
export class CronParseError extends Error {
  constructor(message: string) {
    super('Invalid cron expression: ' + message);
    this.name = 'CronParseError';
  }
}


function expandField(source: string, min: number, max: number): number[] {
  const values = new Set<number>();
  const push = (value: number): void => {
    if (value < min || value > max) {
      throw new CronParseError('value ' + value + ' out of range ' + min + '-' + max);
    }
    values.add(value);
  };

  for (const part of source.split(',')) {
    const stepMatch = /^(\*|\d+(?:-\d+)?)\/(\d+)$/.exec(part);
    const step = stepMatch ? Number(stepMatch[2]) : 1;
    if (step < 1) throw new CronParseError('step must be >= 1 (got ' + step + ')');
    if (stepMatch) {
      const base = stepMatch[1];
      if (base === '*') {
        for (let value = min; value <= max; value += step) push(value);
      } else {
        const range = base.split('-').map(Number);
        if (range.length !== 2) throw new CronParseError('bad step base: ' + base);
        for (let value = range[0]; value <= range[1]; value += step) push(value);
      }
    } else {
      const rangeMatch = /^(\d+)-(\d+)$/.exec(part);
      if (rangeMatch) {
        const low = Number(rangeMatch[1]);
        const high = Number(rangeMatch[2]);
        for (let value = low; value <= high; value++) push(value);
      } else if (part === '*') {
        for (let value = min; value <= max; value++) push(value);
      } else {
        push(Number(part));
      }
    }
  }
  return [...values];
}

/** Parse a standard five-field cron expression. */
export function parseCron(expression: string): CronParts {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new CronParseError('expected 5 fields, got ' + fields.length);
  }
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  return {
    minute: expandField(minute, 0, 59),
    hour: expandField(hour, 0, 23),
    dayOfMonth: expandField(dayOfMonth, 1, 31),
    month: expandField(month, 1, 12),
    dayOfWeek: expandField(dayOfWeek, 0, 6),
  };
}

/** Find the next point in time a cron expression fires strictly after `from`. */
export function nextCron(cron: string, from: Date): Date {
  const parts = parseCron(cron);
  const start = new Date(from.getTime());
  start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() + 1);
  const horizonMs = 8 * 365 * 24 * 60 * 60 * 1000;
  const horizon = from.getTime() + horizonMs;
  while (start.getTime() <= horizon) {
    if (matchesCron(parts, start)) return new Date(start.getTime());
    start.setMinutes(start.getMinutes() + 1);
  }
  throw new CronParseError('no future occurrence within the search horizon');
}

/** Whether a date satisfies a parsed cron expression (minute precision). */
export function matchesCron(parts: CronParts, date: Date): boolean {
  const minute = date.getMinutes();
  const hour = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1;
  const dayOfWeek = date.getDay();
  const domMatch = parts.dayOfMonth.includes(dayOfMonth);
  const dowMatch = parts.dayOfWeek.includes(dayOfWeek);
  // When either day field is '*' (full range), the other alone controls the day.
  const dayMatches =
    parts.dayOfMonth.length === 31 ? dowMatch : parts.dayOfWeek.length === 7 ? domMatch : domMatch && dowMatch;
  return parts.minute.includes(minute) && parts.hour.includes(hour) && dayMatches && parts.month.includes(month);
}

/** Return every interval occurrence strictly after `from` and at or before `upTo`. */
export function nextInterval(seconds: number, from: Date, upTo: Date): Date[] {
  const periodMs = Math.max(1, seconds) * 1000;
  const firstUnix = Math.ceil((from.getTime() + 1) / periodMs) * periodMs;
  const occurrences: Date[] = [];
  for (let time = firstUnix; time <= upTo.getTime(); time += periodMs) {
    occurrences.push(new Date(time));
  }
  return occurrences;
}

/** Normalize an (optional) cron or interval into next due dates. */
export interface ScheduleInput {
  readonly cron?: string;
  readonly seconds?: number;
  readonly upTo?: Date;
}

export function scheduleOccurrences(input: ScheduleInput, from: Date): Date[] {
  const upTo = input.upTo ?? new Date(from.getTime() + 24 * 60 * 60 * 1000);
  const occurrences: Date[] = [];
  if (input.cron) {
    try {
      let next = nextCron(input.cron, from);
      let guard = 0;
      while (next.getTime() <= upTo.getTime() && guard < 1000) {
        occurrences.push(new Date(next.getTime()));
        next = nextCron(input.cron, next);
        guard++;
      }
    } catch {
     
    }
  }
  if (input.seconds) {
    occurrences.push(...nextInterval(input.seconds, from, upTo));
  }
  occurrences.sort((a, b) => a.getTime() - b.getTime());
  return dedupe(occurrences);
}

function dedupe(dates: readonly Date[]): Date[] {
  const seen = new Set<number>();
  const out: Date[] = [];
  for (const date of dates) {
    const key = toUnixSeconds(date);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(date);
    }
  }
  return out;
}

/** Unix-seconds representation of a Date. */
export function toUnixTime(date: Date): number {
  return toUnixSeconds(date);
}