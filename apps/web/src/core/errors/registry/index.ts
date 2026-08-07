import { DEFAULT_ERROR_CATALOG } from '../catalog';
import { createError, isPlatformError } from '../factory';
import type { PlatformError } from '../factory';
import { ERROR_ENGINE_VERSION } from '../metadata';
import { from, normalize, wrap } from '../normalizer';
import { buildSnapshot } from '../snapshot';
import type {
  ErrorCategory,
  ErrorDefinition,
  ErrorInit,
  ErrorMetadata,
  ErrorSeverity,
  ErrorSnapshot,
} from '../types';

export class ErrorEngine {
  readonly version = ERROR_ENGINE_VERSION;
  private readonly definitions = new Map<string, ErrorDefinition>();

  constructor(definitions: readonly ErrorDefinition[] = DEFAULT_ERROR_CATALOG) {
    for (const definition of definitions) {
      this.register(definition);
    }
  }

  // ── Registry ─────────────────────────────────────────────────────────────

  /** Register a typed error definition. Returns false on duplicate code. */
  register(definition: ErrorDefinition): boolean {
    if (this.definitions.has(definition.code)) {
      return false;
    }
    this.definitions.set(definition.code, Object.freeze(definition));
    return true;
  }

  /** Batch-register error definitions; returns the number newly registered. */
  registerAll(definitions: readonly ErrorDefinition[]): number {
    let added = 0;
    for (const definition of definitions) {
      if (this.register(definition)) {
        added += 1;
      }
    }
    return added;
  }

  has(code: string): boolean {
    return this.definitions.has(code);
  }

  /** Static definition for a code — throws when unknown. */
  describe(code: string): ErrorDefinition {
    const definition = this.definitions.get(code);
    if (!definition) {
      throw new Error(`Unknown error code: ${code}`);
    }
    return definition;
  }

  describeIf(code: string): ErrorDefinition | undefined {
    return this.definitions.get(code);
  }

  // ── Creation ─────────────────────────────────────────────────────────────

  /** Create a typed PlatformError for a known code — throws when unknown. */
  create(
    code: string,
    init: ErrorInit = {},
  ): PlatformError {
    return createError({ definition: this.describe(code), ...init });
  }

  /** Create an error, or normalize (UnknownError) when the code is unknown. */
  createIf(code: string, init: ErrorInit = {}): PlatformError {
    const definition = this.describeIf(code);
    if (!definition) {
      return normalize(init.message ?? `Unknown error code: ${code}`, init);
    }
    return createError({ definition, ...init });
  }

  /** Build a typed error and wrap an underlying cause under a known code. */
  wrap(error: unknown, code: string, init: ErrorInit = {}): PlatformError {
    return wrap(error, code, init);
  }

  /** Normalize any thrown value into a PlatformError. */
  from(value: unknown, init: ErrorInit & { code?: string } = {}): PlatformError {
    return from(value, init);
  }

  /** Coerce an unknown value to a PlatformError (always returns an instance). */
  normalize(value: unknown, init: ErrorInit = {}): PlatformError {
    return normalize(value, init);
  }

  // ── Catalog ───────────────────────────────────────────────────────────────

  /** All registered definitions, in registration order. */
  catalog(): readonly ErrorDefinition[] {
    return [...this.definitions.values()];
  }

  byCategory(category: ErrorCategory): readonly ErrorDefinition[] {
    return this.catalog().filter(
      (definition) => definition.category === category,
    );
  }

  bySeverity(severity: ErrorSeverity): readonly ErrorDefinition[] {
    return this.catalog().filter(
      (definition) => definition.severity === severity,
    );
  }

  byCode(code: string): ErrorDefinition | undefined {
    return this.definitions.get(code);
  }

  /** Error codes in the catalog. */
  codes(): string[] {
    return [...this.definitions.keys()];
  }

  // ── Predicates ───────────────────────────────────────────────────────────

  isRetryable(value: unknown): boolean {
    const error = isPlatformError(value) ? value : normalize(value);
    return error.recoverability === 'retryable';
  }

  isPlatform(value: unknown): boolean {
    return isPlatformError(value) ? value.category === 'platform' : false;
  }

  isBusiness(value: unknown): boolean {
    return isPlatformError(value) ? value.category === 'business' : false;
  }

  isInfrastructure(value: unknown): boolean {
    return isPlatformError(value) ? value.category === 'infrastructure' : false;
  }

  isCategory(value: unknown, category: ErrorCategory): boolean {
    return isPlatformError(value) ? value.category === category : false;
  }

  /** Whether a value is a PlatformError instance. */
  isError(value: unknown): value is PlatformError {
    return isPlatformError(value);
  }

  /** Extract the metadata view from any error value. */
  metadata(value: unknown): ErrorMetadata {
    const error = normalize(value);
    return error.toMetadata();
  }

  // ── Snapshots ────────────────────────────────────────────────────────────

  snapshot(): ErrorSnapshot {
    return buildSnapshot(this.catalog());
  }

  /** Total registered error definitions. */
  get size(): number {
    return this.definitions.size;
  }
}

/** Default error engine instance booted over the built-in catalog. */
export const errorEngine: ErrorEngine = new ErrorEngine();