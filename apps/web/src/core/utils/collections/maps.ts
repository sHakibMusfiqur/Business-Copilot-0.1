/** Get a value or a computed default when the key is absent. */
export function getOrDefault<K, V>(
  map: ReadonlyMap<K, V>,
  key: K,
  fallback: V,
): V {
  return map.has(key) ? (map.get(key) as V) : fallback;
}

/** Get a value or lazily-computed fallback when the key is absent. */
export function getOrCreate<K, V>(
  map: Map<K, V>,
  key: K,
  create: (key: K) => V,
): V {
  const existing = map.get(key);
  if (existing !== undefined || map.has(key)) return existing as V;
  const created = create(key);
  map.set(key, created);
  return created;
}

/** Build a Map from an iterable of [key, value] pairs. */
export function createMap<K, V>(entries: readonly (readonly [K, V])[]): Map<K, V> {
  return new Map(entries);
}

/** Map over values, preserving keys. */
export function mapValues<K, V, R>(
  map: ReadonlyMap<K, V>,
  fn: (value: V, key: K) => R,
): Map<K, R> {
  const out = new Map<K, R>();
  for (const [key, value] of map) out.set(key, fn(value, key));
  return out;
}

/** Filter entries by a predicate over (value, key). */
export function filter<K, V>(
  map: ReadonlyMap<K, V>,
  predicate: (value: V, key: K) => boolean,
): Map<K, V> {
  const out = new Map<K, V>();
  for (const [key, value] of map) {
    if (predicate(value, key)) out.set(key, value);
  }
  return out;
}

/** Convert to an array of entries. */
export function entries<K, V>(map: ReadonlyMap<K, V>): [K, V][] {
  return Array.from(map.entries());
}

/** Extract all keys in order. */
export function keys<K>(map: ReadonlyMap<K, unknown>): K[] {
  return Array.from(map.keys());
}

/** Extract all values in order. */
export function values<V>(map: ReadonlyMap<unknown, V>): V[] {
  return Array.from(map.values());
}

/** Invert a Map — value becomes key (last occurrence wins). */
export function invert<K, V>(map: ReadonlyMap<K, V>): Map<V, K> {
  const out = new Map<V, K>();
  for (const [key, value] of map) out.set(value, key);
  return out;
}

/** Merge maps, later maps winning per key. */
export function merge<K, V>(...maps: readonly (ReadonlyMap<K, V> | null | undefined)[]): Map<K, V> {
  const out = new Map<K, V>();
  for (const map of maps) {
    if (!map) continue;
    for (const [key, value] of map) out.set(key, value);
  }
  return out;
}

/** Apply a reducer over entries. */
export function reduce<K, V, R>(
  map: ReadonlyMap<K, V>,
  fn: (acc: R, value: V, key: K) => R,
  initial: R,
): R {
  let acc = initial;
  for (const [key, value] of map) acc = fn(acc, value, key);
  return acc;
}