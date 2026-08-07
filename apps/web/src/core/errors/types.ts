/** Functional category an error belongs to. */
export type ErrorCategory =
  | 'platform'
  | 'business'
  | 'infrastructure'
  | 'security'
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'workflow'
  | 'automation'
  | 'integration'
  | 'plugin'
  | 'storage'
  | 'search'
  | 'configuration'
  | 'ai'
  | 'notification'
  | 'scheduler'
  | 'unknown';

/** Severity of an error. */
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical' | 'fatal';

/** How an error can be recovered from. */
export type ErrorRecoverability =
  | 'retryable'
  | 'nonRetryable'
  | 'manual'
  | 'ignored';

/** Optional retry policy metadata attached to retryable errors. */
export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  multiplier?: number;
}

/** Static, code-based error definition registered in the catalog. */
export interface ErrorDefinition {
  /** Unique error code (e.g. `VALIDATION.INVALID_INPUT`). */
  code: string;
  /** Stable registry id for the error code. */
  id: string;
  name: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoverability: ErrorRecoverability;
  description?: string;
  /** Owning team/domain for the error. */
  owner?: string;
  /** Logical domain the error belongs to. */
  domain?: string;
  version: string;
  retry?: RetryPolicy;
  tags?: readonly string[];
}

/** Opaque metadata common to every raised error instance. */
export interface ErrorMetadata {
  id: string;
  code: string;
  name: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoverability: ErrorRecoverability;
  description?: string;
  owner?: string;
  domain?: string;
  version: string;
  /** ISO timestamp when the error was raised. */
  timestamp: string;
  correlationId?: string;
  cause?: Error;
  details?: Readonly<Record<string, unknown>>;
  context?: Readonly<Record<string, unknown>>;
  tags?: readonly string[];
}

/** Options accepted when creating or wrapping an error instance. */
export interface ErrorInit {
  message?: string;
  correlationId?: string;
  cause?: Error;
  details?: Readonly<Record<string, unknown>>;
  context?: Readonly<Record<string, unknown>>;
  tags?: readonly string[];
}

/** Immutable snapshot of the error catalog at a point in time. */
export interface ErrorSnapshot {
  version: string;
  takenAt: string;
  registry: readonly ErrorDefinition[];
}