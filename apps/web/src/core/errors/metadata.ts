import type { ErrorCategory, ErrorRecoverability, ErrorSeverity } from './types';

/** All supported error categories, in display order. */
export const ERROR_CATEGORIES: readonly ErrorCategory[] = [
  'platform',
  'business',
  'infrastructure',
  'security',
  'authentication',
  'authorization',
  'validation',
  'workflow',
  'automation',
  'integration',
  'plugin',
  'storage',
  'search',
  'configuration',
  'ai',
  'notification',
  'scheduler',
  'unknown',
];

/** All supported error severities. */
export const ERROR_SEVERITIES: readonly ErrorSeverity[] = [
  'info',
  'warning',
  'error',
  'critical',
  'fatal',
];

/** All supported recoverability kinds. */
export const ERROR_RECOVERABILITY: readonly ErrorRecoverability[] = [
  'retryable',
  'nonRetryable',
  'manual',
  'ignored',
];

/** Current error engine schema version. */
export const ERROR_ENGINE_VERSION = '1.0.0';

/** Category descriptor surfaced via `byCategory`/catalog helpers. */
export interface ErrorCategoryDescriptor {
  key: ErrorCategory;
  name: string;
  count: number;
}

/** Build category descriptors from a list of error definitions. */
export function describeCategories(
  errors: readonly { category: ErrorCategory }[],
): readonly ErrorCategoryDescriptor[] {
  return ERROR_CATEGORIES.map((category) => ({
    key: category,
    name: category[0].toUpperCase() + category.slice(1),
    count: errors.filter((error) => error.category === category).length,
  }));
}