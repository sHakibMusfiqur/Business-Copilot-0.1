/** A successful result. */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/** A failed result. */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/** A result is either an Ok value or an Err. */
export type Result<T, E = Error> = Ok<T> | Err<E>;

/** Wrap a value in Ok. */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/** Wrap an error in Err. */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/** Is the result a success? */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

/** Is the result a failure? */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}

/** Run a fallible function, returning a Result. */
export function tryCatch<T, E = Error>(fn: () => T): Result<T, E> {
  try {
    return ok(fn());
  } catch (error) {
    return err(error as E);
  }
}

/** Run an async fallible function, returning a Result. */
export async function tryCatchAsync<T, E = Error>(fn: () => Promise<T>): Promise<Result<T, E>> {
  try {
    return ok(await fn());
  } catch (error) {
    return err(error as E);
  }
}

/** Unwrap the value or throw the error. */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) return result.value;
  throw result.error;
}

/** Unwrap the value or return a fallback. */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return isOk(result) ? result.value : fallback;
}

/** Map over the Ok value; errors pass through. */
export function map<T, E, R>(result: Result<T, E>, fn: (value: T) => R): Result<R, E> {
  return isOk(result) ? ok(fn(result.value)) : result;
}

/** Map the error; values pass through. */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  return isOk(result) ? result : err(fn(result.error));
}

/** Chain a function that also returns a Result. */
export function flatMap<T, E, R>(result: Result<T, E>, fn: (value: T) => Result<R, E>): Result<R, E> {
  return isOk(result) ? fn(result.value) : result;
}

/** Collect the Ok values of a list; return the first Err when any failed. */
export function all<T, E>(results: readonly Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (isErr(result)) return result;
    values.push(result.value);
  }
  return ok(values);
}

/** Convert an optional value to a Result. */
export function fromNullable<T, E>(value: T | null | undefined, error: E): Result<T, E> {
  return value === null || value === undefined ? err(error) : ok(value);
}