import { DEFAULT_ERROR_CODE_INDEX } from '../catalog';
import { createError, isPlatformError, UnknownError } from '../factory';
import type { PlatformError } from '../factory';
import type { ErrorDefinition, ErrorInit } from '../types';

/** Safety fallback in case the UNKNOWN.ERROR catalog entry is absent. */
const UNKNOWN_FALLBACK: ErrorDefinition = {
  code: 'UNKNOWN.ERROR',
  id: 'unknown-002',
  name: 'Unknown Error',
  category: 'unknown',
  severity: 'error',
  recoverability: 'manual',
  version: '1.0.0',
};


export function normalize(
  value: unknown,
  init: ErrorInit = {},
): PlatformError {
  if (isPlatformError(value)) {
    return value;
  }
  const definition =
    DEFAULT_ERROR_CODE_INDEX.get('UNKNOWN.ERROR') ?? UNKNOWN_FALLBACK;
  const cause = value instanceof Error ? value : undefined;
  return createError({
    definition,
    message: init.message ?? (value instanceof Error ? value.message : String(value)),
    cause: init.cause ?? cause,
    correlationId: init.correlationId,
    details: init.details,
    context: init.context,
    tags: init.tags,
  });
}

export function from(
  value: unknown,
  init: ErrorInit & { code?: string } = {},
): PlatformError {
  if (isPlatformError(value)) {
    return value;
  }
  const definition = init.code
    ? DEFAULT_ERROR_CODE_INDEX.get(init.code)
    : undefined;
  if (definition) {
    const cause =
      init.cause ??
      (value instanceof Error ? value : undefined);
    return fromDefinition(definition, { ...init, cause });
  }
  return normalize(value, init);
}

export function wrap(
  error: unknown,
  code: string | ErrorDefinition,
  init: ErrorInit = {},
): PlatformError {
  const cause = error instanceof Error ? error : undefined;
  const definition =
    typeof code === 'string'
      ? DEFAULT_ERROR_CODE_INDEX.get(code)
      : code;
  if (!definition) {
    return normalize(error, { ...init, cause: init.cause ?? cause });
  }
  return fromDefinition(definition, { ...init, cause: init.cause ?? cause });
}

/** Build an instance for a concrete definition. */
function fromDefinition(definition: ErrorDefinition, init: ErrorInit): PlatformError {
  return createError({
    definition,
    message: init.message,
    correlationId: init.correlationId,
    cause: init.cause,
    details: init.details,
    context: init.context,
    tags: init.tags,
  });
}

/** Re-export for callers that want the concrete unknown class. */
export { UnknownError };