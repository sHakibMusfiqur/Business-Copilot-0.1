/** Memoize a single-argument function by reference equality of its key. */
export function memoize<A, R>(fn: (arg: A) => R): (arg: A) => R {
  const cache = new Map<A, R>();
  return (arg: A): R => {
    if (cache.has(arg)) return cache.get(arg) as R;
    const value = fn(arg);
    cache.set(arg, value);
    return value;
  };
}

/** Memoize a variadic function keyed by a string key builder. */
export function memoizeBy<A extends unknown[], R>(
  fn: (...args: A) => R,
  keyOf: (...args: A) => string,
): {
  (...args: A): R;
  clear(): void;
} {
  const cache = new Map<string, R>();
  const memoized = (...args: A): R => {
    const key = keyOf(...args);
    if (cache.has(key)) return cache.get(key) as R;
    const value = fn(...args);
    cache.set(key, value);
    return value;
  };
  memoized.clear = (): void => cache.clear();
  return memoized;
}

/** Memoize a variadic function by its JSON-serialized arguments. */
export function memoizeByArgs<A extends unknown[], R>(
  fn: (...args: A) => R,
): {
  (...args: A): R;
  clear(): void;
} {
  return memoizeBy(fn, (...args: A) => JSON.stringify(args));
}

/** Memoize an async function keyed by a string key builder. */
export function memoizeAsync<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  keyOf: (...args: A) => string,
): {
  (...args: A): Promise<R>;
  clear(): void;
} {
  const cache = new Map<string, Promise<R>>();
  const memoized = (...args: A): Promise<R> => {
    const key = keyOf(...args);
    let pending = cache.get(key);
    if (!pending) {
      pending = fn(...args).finally(() => {
        cache.delete(key);
      });
      cache.set(key, pending);
    }
    return pending;
  };
  memoized.clear = (): void => cache.clear();
  return memoized;
}

/** Run a function at most once; later calls return the first result. */
export function once<R>(fn: () => R): () => R {
  let called = false;
  let value: R;
  return (): R => {
    if (!called) {
      called = true;
      value = fn();
    }
    return value;
  };
}

/** Memoize a single-argument function with an expiration TTL in ms. */
export function memoizeTtl<A, R>(fn: (arg: A) => R, ttlMs: number): (arg: A) => R {
  const cache = new Map<A, { value: R; expires: number }>();
  return (arg: A): R => {
    const now = Date.now();
    const entry = cache.get(arg);
    if (entry && entry.expires > now) return entry.value;
    const value = fn(arg);
    cache.set(arg, { value, expires: now + ttlMs });
    return value;
  };
}