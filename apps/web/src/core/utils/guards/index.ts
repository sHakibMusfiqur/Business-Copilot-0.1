/** Type predicate: is `value` a string? */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/** Type predicate: is `value` a number (and not NaN)? */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/** Type predicate: is `value` a bigint? */
export function isBigInt(value: unknown): value is bigint {
  return typeof value === 'bigint';
}

/** Type predicate: is `value` a boolean? */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/** Type predicate: is `value` a function? */
export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

/** Type predicate: is `value` an object (non-null), including arrays/functions? */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Type predicate: is `value` a plain object literal? */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Type predicate: is `value` an array? */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/** Type predicate: is `value` a Date instance? */
export function isDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/** Type predicate: is `value` a Promise instance? */
export function isPromise(value: unknown): value is Promise<unknown> {
  return typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function';
}

/** Is `value` `null`? */
export function isNull(value: unknown): value is null {
  return value === null;
}

/** Is `value` `undefined`? */
export function isUndefined(value: unknown): value is undefined {
  return value === undefined;
}

/** Is `value` `null` or `undefined`? */
export function isNil(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/** Is a string composed only of whitespace, or empty? */
export function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

/** Is the array empty? */
export function isEmptyArray<T>(value: readonly T[]): value is readonly [] {
  return value.length === 0;
}

/** Is a numeric value finite? */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Is `value` an even integer? */
export function isEven(value: number): boolean {
  return value % 2 === 0;
}

/** Is `value` an odd integer? */
export function isOdd(value: number): boolean {
  return Math.abs(value % 2) === 1;
}

/** Is `value` within a closed interval [min, max]? */
export function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}