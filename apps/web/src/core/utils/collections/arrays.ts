/** First element, or `undefined` when empty. */
export function first<T>(items: readonly T[]): T | undefined {
  return items[0];
}

/** Last element, or `undefined` when empty. */
export function last<T>(items: readonly T[]): T | undefined {
  return items.length > 0 ? items[items.length - 1] : undefined;
}

/** Remove falsy values. */
export function compact<T>(items: readonly (T | null | undefined | false | 0 | '')[]): T[] {
  return items.filter((item) => Boolean(item)) as T[];
}

/** Unique values, preserving first-seen order. */
export function unique<T>(items: readonly T[]): T[] {
  return Array.from(new Set(items));
}

/** Unique values by an extracted key, preserving first-seen order. */
export function uniqueBy<T, K>(items: readonly T[], key: (item: T) => K): T[] {
  const seen = new Set<K>();
  const result: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (!seen.has(k)) {
      seen.add(k);
      result.push(item);
    }
  }
  return result;
}

/** Split an array into two groups by a predicate. */
export function partition<T>(
  items: readonly T[],
  predicate: (item: T) => boolean,
): [T[], T[]] {
  const yes: T[] = [];
  const no: T[] = [];
  for (const item of items) {
    if (predicate(item)) yes.push(item);
    else no.push(item);
  }
  return [yes, no];
}

/** Split into fixed-size chunks. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/** Group items by an extracted key into a plain record. */
export function groupBy<T, K extends PropertyKey>(
  items: readonly T[],
  keyOf: (item: T) => K,
): Record<K, T[]> {
  const result = Object.create(null) as Record<K, T[]>;
  for (const item of items) {
    const key = keyOf(item);
    result[key] ??= [];
    result[key].push(item);
  }
  return result;
}

/** Flatten one level of nested arrays. */
export function flatten<T>(items: readonly (readonly T[] | T)[]): T[] {
  const out: T[] = [];
  for (const item of items) {
    if (Array.isArray(item)) {
      for (const inner of item) out.push(inner);
    } else {
      out.push(item as T);
    }
  }
  return out;
}

/** Flatten nested arrays deeply. */
export function flattenDeep<T>(items: readonly unknown[]): T[] {
  const out: T[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
    } else {
      out.push(value as T);
    }
  };
  walk(items);
  return out;
}

/** Range `[0, end)` or `[start, end)` (exclusive). */
export function range(start: number, end?: number, step = 1): number[] {
  const from = end === undefined ? 0 : start;
  const to = end === undefined ? start : end;
  if (step === 0) return [];
  const out: number[] = [];
  if (step > 0) {
    for (let i = from; i < to; i += step) out.push(i);
  } else {
    for (let i = from; i > to; i += step) out.push(i);
  }
  return out;
}

/** Sum of numeric items. */
export function sum(items: readonly number[]): number {
  let total = 0;
  for (const item of items) total += item;
  return total;
}

/** Average of numeric items; NaN when empty. */
export function average(items: readonly number[]): number {
  return items.length === 0 ? Number.NaN : sum(items) / items.length;
}

/** Maximum value; undefined when empty. */
export function max(items: readonly number[]): number | undefined {
  return items.length === 0 ? undefined : Math.max(...items);
}

/** Minimum value; undefined when empty. */
export function min(items: readonly number[]): number | undefined {
  return items.length === 0 ? undefined : Math.min(...items);
}

/** Sort by a mapped comparable key, ascending. */
export function sortBy<T>(items: readonly T[], keyOf: (item: T) => number | string): T[] {
  return [...items].sort((a, b) => {
    const ka = keyOf(a);
    const kb = keyOf(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

/** Remove the first occurrence of `value`; returns the item when found. */
export function remove<T>(items: readonly T[], value: T): { rest: T[]; removed?: T } {
  const index = items.indexOf(value);
  if (index === -1) return { rest: [...items] };
  return { rest: items.filter((_, i) => i !== index), removed: value };
}

/** Elements present in `a` but not in `b`. */
export function difference<T>(a: readonly T[], b: readonly T[]): T[] {
  const set = new Set(b);
  return a.filter((item) => !set.has(item));
}

/** Elements present in both `a` and `b`. */
export function intersection<T>(a: readonly T[], b: readonly T[]): T[] {
  const set = new Set(b);
  return a.filter((item) => set.has(item));
}

/** Does `items` contain `value`? */
export function contains<T>(items: readonly T[], value: T): boolean {
  return items.includes(value);
}