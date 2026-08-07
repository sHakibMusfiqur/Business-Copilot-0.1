/** Is a value a valid Date object? */
export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/** ISO-8601 string, or null when the date is invalid. */
export function toISO(date: Date): string | null {
  return isValidDate(date) ? date.toISOString() : null;
}

/** Unix timestamp (seconds). */
export function toUnixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/** Date from a Unix timestamp (seconds). */
export function fromUnixSeconds(seconds: number): Date {
  return new Date(seconds * 1000);
}

/** Start of day (00:00:00.000). */
export function startOfDay(date: Date): Date {
  const out = new Date(date);
  out.setHours(0, 0, 0, 0);
  return out;
}

/** End of day (23:59:59.999). */
export function endOfDay(date: Date): Date {
  const out = new Date(date);
  out.setHours(23, 59, 59, 999);
  return out;
}

/** Add whole days. */
export function addDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

/** Add whole months (clamped to the month's last day). */
export function addMonths(date: Date, months: number): Date {
  const out = new Date(date);
  const day = out.getDate();
  out.setDate(1);
  out.setMonth(out.getMonth() + months);
  out.setDate(Math.min(day, daysInMonth(out)));
  return out;
}

/** Number of days in the month of `date`. */
export function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/** Calendar difference in whole days (first >= second). */
export function diffInDays(first: Date, second: Date): number {
  const a = startOfDay(first).getTime();
  const b = startOfDay(second).getTime();
  return Math.round((a - b) / 86_400_000);
}

/** Is `first` before `second`? */
export function isBefore(first: Date, second: Date): boolean {
  return first.getTime() < second.getTime();
}

/** Is `first` after `second`? */
export function isAfter(first: Date, second: Date): boolean {
  return first.getTime() > second.getTime();
}

/** Are two dates on the same calendar day? */
export function isSameDay(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

/** Format using a locale string pattern (e.g. `2024-01-31`). */
export function format(date: Date, pattern = 'YYYY-MM-DD'): string {
  const y = String(date.getFullYear());
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  const replacements: Record<string, string> = {
    YYYY: y,
    MM: mo,
    DD: d,
    HH: h,
    mm: mi,
    ss: s,
  };
  return pattern.replace(/YYYY|MM|DD|HH|mm|ss/g, (token) => replacements[token] ?? token);
}

/** Relative time difference between two dates in whole days. */
export function diffInDaysAbs(first: Date, second: Date): number {
  return Math.abs(diffInDays(first, second));
}