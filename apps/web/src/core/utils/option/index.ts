import { ok, err, type Result } from '../result';

/** A present value. */
export interface Some<T> {
  readonly some: true;
  readonly value: T;
}

/** An absent value. */
export interface None {
  readonly some: false;
}

/** An option is either Some or None. */
export type Option<T> = Some<T> | None;

/** Wrap a present value. */
export function some<T>(value: T): Some<T> {
  return { some: true, value };
}

/** The absent value. */
export function none(): None {
  return { some: false };
}

/** Is the option present? */
export function isSome<T>(option: Option<T>): option is Some<T> {
  return option.some;
}

/** Is the option absent? */
export function isNone<T>(option: Option<T>): option is None {
  return !option.some;
}

/** Convert a nullable value into an Option. */
export function fromNullable<T>(value: T | null | undefined): Option<T> {
  return value === null || value === undefined ? none() : some(value);
}

/** Unwrap the value or return a fallback. */
export function unwrapOr<T>(option: Option<T>, fallback: T): T {
  return option.some ? option.value : fallback;
}

/** Map over the present value; None passes through. */
export function map<T, R>(option: Option<T>, fn: (value: T) => R): Option<R> {
  return option.some ? some(fn(option.value)) : none();
}

/** Chain a function that also returns an Option. */
export function flatMap<T, R>(option: Option<T>, fn: (value: T) => Option<R>): Option<R> {
  return option.some ? fn(option.value) : none();
}

/** Collect the present values of a list. */
export function compact<T>(options: readonly Option<T>[]): T[] {
  const out: T[] = [];
  for (const option of options) {
    if (option.some) out.push(option.value);
  }
  return out;
}

/** First present value across options, or None. */
export function firstSome<T>(options: readonly Option<T>[]): Option<T> {
  for (const option of options) {
    if (option.some) return option;
  }
  return none();
}

/** Convert an Option into a Result. */
export function toResult<T, E>(option: Option<T>, error: E): Result<T, E> {
  return option.some ? ok(option.value) : err(error);
}