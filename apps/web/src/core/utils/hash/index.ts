/** FNV-1a 32-bit hash, returned as an unsigned 32-bit number. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** FNV-1a 32-bit hash, returned as a zero-padded hex string. */
export function hashHex(value: string): string {
  return hashString(value).toString(16).padStart(8, '0');
}

export function stableSerialize(value: unknown): string {
  if (value === null) return 'null';
  const type = typeof value;
  if (type !== 'object') return String(value);
  if (value instanceof Date) return `Date:${value.getTime()}`;
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }
  if (value instanceof Map) {
    const entries = Array.from((value as Map<unknown, unknown>).entries())
      .sort(([a], [b]) => stableSerialize(a).localeCompare(stableSerialize(b)))
      .map(([k, v]) => `${stableSerialize(k)}:${stableSerialize(v)}`)
      .join(',');
    return `Map{${entries}}`;
  }
  if (value instanceof Set) {
    const items = Array.from(value as Set<unknown>)
      .map(stableSerialize)
      .sort()
      .join(',');
    return `Set{${items}}`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const body = keys
    .map((key) => `${key}:${stableSerialize((value as Record<string, unknown>)[key])}`)
    .join(',');
  return `{${body}}`;
}

/** Stable object hash (FNV-1a hex over the stable serialization). */
export function hashObject(value: unknown): string {
  return hashHex(stableSerialize(value));
}

/** A simple string hash for dictionary-index keys. */
export function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}