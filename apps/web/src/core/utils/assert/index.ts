/** Thrown when a runtime condition is not met. */
export class AssertionError extends Error {
  readonly condition: string;
  constructor(message: string, condition = 'assertion') {
    super(message);
    this.name = 'AssertionError';
    this.condition = condition;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Assert that `value` is truthy; otherwise throw. */
export function assert(
  value: unknown,
  message?: string,
): asserts value is NonNullable<unknown> {
  if (!value) {
    throw new AssertionError(message ?? 'Expected a truthy value.');
  }
}

/** Assert a boolean condition; otherwise throw. */
export function assertThat(condition: boolean, message?: string): void {
  if (!condition) {
    throw new AssertionError(message ?? 'Condition was not satisfied.');
  }
}

/** Assert that `value` is not `null` or `undefined`. */
export function assertDefined<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new AssertionError(message ?? 'Expected a defined (non-null) value.');
  }
}

/** Assert that `value` is not `undefined`. */
export function assertNonNull<T>(value: T | null, message?: string): asserts value is T {
  if (value === null) {
    throw new AssertionError(message ?? 'Expected a non-null value.');
  }
}

/** Assert that `value` is a string. */
export function assertFunction<T extends (...args: unknown[]) => unknown>(
  value: unknown,
  message?: string,
): asserts value is T {
  if (typeof value !== 'function') {
    throw new AssertionError(message ?? 'Expected a function.');
  }
}

/** Assert that `value` is a registered function. */
export function assertCallable<T extends (...args: never[]) => unknown>(
  value: unknown,
  message?: string,
): asserts value is T {
  if (typeof value !== 'function') {
    throw new AssertionError(message ?? 'Expected a callable function.');
  }
}