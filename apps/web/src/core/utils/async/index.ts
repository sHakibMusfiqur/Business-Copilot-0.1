/** Sleep for `ms` milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wait for a promise or reject after `ms` milliseconds. */
export function withTimeout<T>(promise: Promise<T>, ms: number, message = 'Operation timed out.'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Options for retry. */
export interface RetryOptions {
  /** Maximum number of attempts (>= 1). */
  attempts: number;
  /** Base delay before the first retry, in ms. */
  baseDelayMs?: number;
  /** Multiplier applied to the delay after each attempt. */
  multiplier?: number;
  /** Maximum delay between attempts, in ms. */
  maxDelayMs?: number;
  /** Predicate deciding whether an error is retryable (default: all). */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

/** Retry an async task with backoff; returns its resolved value. */
export async function retry<T>(
  task: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const attempts = Math.max(1, options.attempts);
  const baseDelayMs = options.baseDelayMs ?? 0;
  const multiplier = options.multiplier ?? 1;
  const maxDelayMs = options.maxDelayMs ?? Number.POSITIVE_INFINITY;
  const shouldRetry = options.shouldRetry ?? (() => true);

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !shouldRetry(error, attempt)) break;
      const delay = Math.min(maxDelayMs, baseDelayMs * Math.pow(multiplier, attempt - 1));
      if (delay > 0) await sleep(delay);
    }
  }
  throw lastError;
}

/** Debounce a function — trailing edge execution after the quiet window. */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number,
): {
  (...args: A): void;
  cancel(): void;
} {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = (...args: A): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, waitMs);
  };
  debounced.cancel = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };
  return debounced;
}

/** Throttle a function — at most one trailing execution per window. */
export function throttle<A extends unknown[]>(
  fn: (...args: A) => void,
  limitMs: number,
): {
  (...args: A): void;
  cancel(): void;
} {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingArgs: A | undefined;

  const invoke = (): void => {
    timer = undefined;
    if (pendingArgs !== undefined) {
      const args = pendingArgs;
      pendingArgs = undefined;
      last = Date.now();
      fn(...args);
    }
  };

  const throttled = (...args: A): void => {
    const now = Date.now();
    const remaining = limitMs - (now - last);
    if (remaining <= 0) {
      if (timer !== undefined) clearTimeout(timer);
      last = now;
      fn(...args);
      return;
    }
    pendingArgs = args;
    if (timer === undefined) {
      timer = setTimeout(invoke, remaining);
    }
  };
  throttled.cancel = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    pendingArgs = undefined;
  };
  return throttled;
}

/** Run async tasks in sequence, collecting results. */
export async function mapSeries<A, R>(
  items: readonly A[],
  fn: (item: A, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i++) out.push(await fn(items[i], i));
  return out;
}

/** Run async tasks with a bounded concurrency; resolves in input order. */
export async function mapParallel<A, R>(
  items: readonly A[],
  limit: number,
  fn: (item: A, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  };

  const workers = Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/** Call an async fn; on error return the fallback instead of throwing. */
export async function fallback<T>(
  fn: () => Promise<T>,
  fallbackValue: T,
): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallbackValue;
  }
}

/** Create a resolvable deferred. */
export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

/** Create a deferred. */
export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}