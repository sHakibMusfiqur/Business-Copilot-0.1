/** Add many values at once; returns the set. */
export function addAll<T>(set: Set<T>, values: readonly T[]): Set<T> {
  for (const value of values) set.add(value);
  return set;
}

/** Union of sets. */
export function union<T>(...sets: readonly (ReadonlySet<T> | null | undefined)[]): Set<T> {
  const out = new Set<T>();
  for (const set of sets) {
    if (!set) continue;
    for (const value of set) out.add(value);
  }
  return out;
}

/** Intersection of two or more sets. */
export function intersect<T>(...sets: readonly ReadonlySet<T>[]): Set<T> {
  if (sets.length === 0) return new Set<T>();
  const out = new Set<T>();
  const [firstSet, ...rest] = sets;
  for (const value of firstSet) {
    if (rest.every((set) => set.has(value))) out.add(value);
  }
  return out;
}

/** Values present in `a` but not in `b`. */
export function difference<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): Set<T> {
  const out = new Set<T>();
  for (const value of a) {
    if (!b.has(value)) out.add(value);
  }
  return out;
}

/** Is `a` a subset of `b`? */
export function isSubset<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

/** Do two sets share at least one value? */
export function intersects<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  for (const value of a) {
    if (b.has(value)) return true;
  }
  return false;
}

/** Does the set contain every value? */
export function containsAll<T>(set: ReadonlySet<T>, values: readonly T[]): boolean {
  return values.every((value) => set.has(value));
}

/** Convert to an array, in iteration order. */
export function toArray<T>(set: ReadonlySet<T>): T[] {
  return Array.from(set);
}

/** Remove values matching a predicate. */
export function filter<T>(set: ReadonlySet<T>, predicate: (value: T) => boolean): Set<T> {
  const out = new Set<T>();
  for (const value of set) {
    if (predicate(value)) out.add(value);
  }
  return out;
}

/** Map over values into a new set. */
export function map<T, R>(set: ReadonlySet<T>, fn: (value: T) => R): Set<R> {
  const out = new Set<R>();
  for (const value of set) out.add(fn(value));
  return out;
}