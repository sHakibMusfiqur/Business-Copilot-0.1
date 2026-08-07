type PlainObject = Record<string, unknown>;

/**
 * Assign `key` onto `target` without risking prototype pollution.
 * Own `__proto__` keys (e.g. from `JSON.parse`) are written as own
 * data properties instead of mutating the prototype chain.
 */
function safeSet(target: PlainObject, key: string, value: unknown): void {
  if (key === '__proto__') {
    Object.defineProperty(target, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  } else {
    target[key] = value;
  }
}

/** Deep-clone a value, preserving arrays, plain objects, Date, Map and Set. */
export function clone<V>(value: V): V {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => clone(item)) as unknown as V;
  }
  if (value instanceof Date) {
    return new Date(value.getTime()) as unknown as V;
  }
  if (value instanceof Map) {
    const out = new Map();
    for (const [k, v] of value as Map<unknown, unknown>) out.set(k, clone(v));
    return out as unknown as V;
  }
  if (value instanceof Set) {
    const out = new Set();
    for (const item of value as Set<unknown>) out.add(clone(item));
    return out as unknown as V;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;
  const out: PlainObject = {};
  for (const key of Object.keys(value as PlainObject)) {
    safeSet(out, key, clone((value as PlainObject)[key]));
  }
  return out as unknown as V;
}

/** Shallow equal — compares own enumerable keys and primitives. */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  const ka = Object.keys(a as PlainObject);
  const kb = Object.keys(b as PlainObject);
  if (ka.length !== kb.length) return false;
  for (const key of ka) {
    if (!Object.is((a as PlainObject)[key], (b as PlainObject)[key])) return false;
  }
  return true;
}

/** Deep equal across primitives, arrays, plain objects, Date, Map and Set. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map) || !(b instanceof Map) || a.size !== b.size) return false;
    for (const [k, v] of a) {
      if (!b.has(k) || !deepEqual(v, b.get(k))) return false;
    }
    return true;
  }
  if (a instanceof Set || b instanceof Set) {
    if (!(a instanceof Set) || !(b instanceof Set) || a.size !== b.size) return false;
    for (const item of a) {
      if (!b.has(item)) return false;
    }
    return true;
  }
  const ka = Object.keys(a as PlainObject);
  const kb = Object.keys(b as PlainObject);
  if (ka.length !== kb.length) return false;
  for (const key of ka) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual((a as PlainObject)[key], (b as PlainObject)[key])) return false;
  }
  return true;
}

/** Mutating deep merge — merges sources into the target, later winning. */
export function deepMerge(...sources: readonly (PlainObject | null | undefined)[]): PlainObject {
  const out: PlainObject = {};
  for (const source of sources) {
    if (!source) continue;
    for (const key of Object.keys(source)) {
      const value = source[key];
      const existing = out[key];
      if (
        existing &&
        value &&
        isPlain(existing) &&
        isPlain(value) &&
        !Array.isArray(existing) &&
        !Array.isArray(value)
      ) {
        safeSet(out, key, deepMerge(existing as PlainObject, value as PlainObject));
      } else {
        safeSet(out, key, value);
      }
    }
  }
  return out;
}

/** Is the value a plain object? */
function isPlain(value: unknown): value is PlainObject {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Non-mutating deep merge — returns a new object per key-path. */
export function merge(...sources: readonly (PlainObject | null | undefined)[]): PlainObject {
  return deepMerge(...sources);
}

/** Pick listed keys into a new object. */
export function pick<T extends PlainObject, K extends keyof T & string>(
  source: T,
  keys: readonly K[],
): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in source) out[key] = source[key];
  }
  return out;
}

/** Omit listed keys, returning a new object. */
export function omit<T extends PlainObject, K extends keyof T & string>(
  source: T,
  keys: readonly K[],
): Omit<T, K> {
  const excluded = new Set<string>(keys.map(String));
  const out = {} as Omit<T, K>;
  for (const key of Object.keys(source)) {
    if (!excluded.has(key)) (out as Record<string, unknown>)[key] = source[key];
  }
  return out;
}

/** Keys of an object, typed. */
export function objectKeys<T extends PlainObject>(value: T): (keyof T & string)[] {
  return Object.keys(value) as (keyof T & string)[];
}

/** Number of own enumerable keys. */
export function size(value: PlainObject): number {
  return Object.keys(value).length;
}

/** Is the object free of own enumerable keys? */
export function isEmptyObject(value: PlainObject): boolean {
  return Object.keys(value).length === 0;
}

/** Map over the values of a plain object. */
export function mapValues<T, R>(value: Record<string, T>, fn: (v: T, k: string) => R): Record<string, R> {
  const out: Record<string, R> = {};
  for (const key of Object.keys(value)) out[key] = fn(value[key], key);
  return out;
}