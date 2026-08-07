/** Clamp a value into the closed interval [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Round to a specified number of decimal places. */
export function round(value: number, precision = 0): number {
  const factor = Math.pow(10, precision);
  return Math.round(value * factor) / factor;
}

/** Floor to a specified number of decimal places. */
export function floor(value: number, precision = 0): number {
  const factor = Math.pow(10, precision);
  return Math.floor(value * factor) / factor;
}

/** Ceil to a specified number of decimal places. */
export function ceil(value: number, precision = 0): number {
  const factor = Math.pow(10, precision);
  return Math.ceil(value * factor) / factor;
}

/** Random integer within [min, max] inclusive. */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Percentage value (0..100) when total is non-zero, else 0. */
export function percentage(part: number, total: number, precision = 0): number {
  return total === 0 ? 0 : round((part / total) * 100, precision);
}

/** Sum of numeric values. */
export function sum(...values: readonly number[]): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

/** Format a number with grouped thousands, fixed decimals per options. */
export function formatNumber(value: number, precision = 0): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(value);
}

/** Human-readable byte size (e.g. `1.5 MB`). */
export function formatBytes(bytes: number, precision = 1): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  const scaled = bytes / Math.pow(1024, index);
  return `${scaled.toFixed(clamp(index === 0 ? 0 : precision, 0, 3))} ${units[clamp(index, 0, units.length - 1)]}`;
}

/** Is a value within [min, max] inclusive? */
export function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/** Remainder with a positive result. */
export function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

/** Absolute difference between two numbers. */
export function diff(a: number, b: number): number {
  return Math.abs(a - b);
}