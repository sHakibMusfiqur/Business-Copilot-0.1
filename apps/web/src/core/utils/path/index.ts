type Obj = Record<string, unknown>;

/** Tokenize a path into array indices / segment names. */
export function parsePath(path: string): Array<string | number> {
  const tokens: Array<string | number> = [];
  const segment = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  for (const part of segment) {
    if (part.length === 0) continue;
    tokens.push(/^\d+$/.test(part) ? Number(part) : part);
  }
  return tokens;
}

/** Assign `key` onto `target` without risking prototype pollution. */
function safeSet(target: Obj, key: string, value: unknown): void {
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

/** Read a value at a path; returns `undefined` when absent. */
export function get<T>(source: Obj, path: string): T | undefined {
  let current: unknown = source;
  for (const token of parsePath(path)) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Obj)[token];
  }
  return current as T;
}

/** Does the path resolve to a value? */
export function has(source: Obj, path: string): boolean {
  return get(source, path) !== undefined || hasOwnPath(source, parsePath(path));
}

function hasOwnPath(source: unknown, tokens: Array<string | number>): boolean {
  let current: unknown = source;
  for (const token of tokens) {
    if (current === null || current === undefined || typeof current !== 'object') return false;
    if (!(token in (current as Obj))) return false;
    current = (current as Obj)[token];
  }
  return true;
}

/** Set a value at a path, creating intermediate objects/arrays as needed. */
export function set(source: Obj, path: string, value: unknown): Obj {
  const tokens = parsePath(path);
  const out: Obj = { ...source };
  let cursor: Obj = out;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const isLast = i === tokens.length - 1;

    if (isLast) {
      safeSet(cursor, String(token), value);
      break;
    }

    const existing = (cursor as Obj)[token];
    const container = existing !== null && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Obj) }
      : {};
    safeSet(cursor, String(token), container);
    cursor = container;
  }

  return out;
}

/** Produce a flat map of dotted-path -> leaf value. */
export function entries(source: Obj): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const walk = (value: unknown, prefix: string): void => {
    if (value === null || typeof value !== 'object') {
      safeSet(out, prefix, value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${prefix}[${index}]`));
      return;
    }
    for (const key of Object.keys(value as Obj)) {
      const next = prefix ? `${prefix}.${key}` : key;
      walk((value as Obj)[key], next);
    }
  };
  walk(source, '');
  return out;
}

/** Merge a flat dotted-keys record into a nested plain object. */
export function unflatten(flat: Record<string, unknown>): Obj {
  let out: Obj = {};
  for (const dotted of Object.keys(flat)) {
    out = set(out, dotted, flat[dotted]);
  }
  return out;
}