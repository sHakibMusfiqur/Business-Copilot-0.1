import type { ErrorCategory, ErrorDefinition, ErrorInit, ErrorMetadata } from '../types';

/** Options for creating a concrete error instance. */
export interface CreateErrorOptions {
  definition: ErrorDefinition;
  message?: string;
  correlationId?: string;
  cause?: Error;
  details?: Readonly<Record<string, unknown>>;
  context?: Readonly<Record<string, unknown>>;
  tags?: readonly string[];
}

export class PlatformError extends Error implements ErrorMetadata {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly category: ErrorCategory;
  readonly severity: ErrorDefinition['severity'];
  readonly recoverability: ErrorDefinition['recoverability'];
  readonly description?: string;
  readonly owner?: string;
  readonly domain?: string;
  readonly version: string;
  readonly timestamp: string;
  readonly correlationId?: string;
  readonly cause?: Error;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly context?: Readonly<Record<string, unknown>>;
  readonly tags?: readonly string[];

  constructor(options: CreateErrorOptions) {
    const message =
      options.message ??
      options.definition.description ??
      `${options.definition.code}: ${options.definition.name}`;
    super(message);
    this.name = options.definition.name;
    this.id = options.definition.id;
    this.code = options.definition.code;
    this.category = options.definition.category;
    this.severity = options.definition.severity;
    this.recoverability = options.definition.recoverability;
    this.description = options.definition.description;
    this.owner = options.definition.owner;
    this.domain = options.definition.domain;
    this.version = options.definition.version;
    this.timestamp = new Date().toISOString();
    this.correlationId = options.correlationId;
    this.cause = options.cause;
    this.details = options.details;
    this.context = options.context;
    this.tags = options.tags;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /** Full metadata view of this error. */
  toMetadata(): ErrorMetadata {
    return {
      id: this.id,
      code: this.code,
      name: this.name,
      category: this.category,
      severity: this.severity,
      recoverability: this.recoverability,
      description: this.description,
      owner: this.owner,
      domain: this.domain,
      version: this.version,
      timestamp: this.timestamp,
      correlationId: this.correlationId,
      cause: this.cause,
      details: this.details,
      context: this.context,
      tags: this.tags,
    };
  }
}

/** Business domain rule/flow errors. */
export class BusinessError extends PlatformError {}
/** Input failed validation. */
export class ValidationError extends PlatformError {}
/** Caller failed authentication. */
export class AuthenticationError extends PlatformError {}
/** Caller is not authorized. */
export class AuthorizationError extends PlatformError {}
/** Infrastructure / dependency faults. */
export class InfrastructureError extends PlatformError {}
/** Configuration faults. */
export class ConfigurationError extends PlatformError {}
/** Feature-related faults. */
export class FeatureError extends PlatformError {}
/** Module-related faults. */
export class ModuleError extends PlatformError {}
/** Workflow execution faults. */
export class WorkflowError extends PlatformError {}
/** Automation run faults. */
export class AutomationError extends PlatformError {}
/** Plugin runtime faults. */
export class PluginError extends PlatformError {}
/** Third-party integration faults. */
export class IntegrationError extends PlatformError {}
/** Storage backend faults. */
export class StorageError extends PlatformError {}
/** Search backend faults. */
export class SearchError extends PlatformError {}
/** AI runtime faults. */
export class AIError extends PlatformError {}
/** Notification delivery faults. */
export class NotificationError extends PlatformError {}
/** Scheduled task faults. */
export class SchedulerError extends PlatformError {}
/** Security faults. */
export class SecurityError extends PlatformError {}
/** Unknown / unclassified faults. */
export class UnknownError extends PlatformError {}

/** Map of error category -> error class. */
const CLASS_BY_CATEGORY: Readonly<Record<ErrorCategory, new (options: CreateErrorOptions) => PlatformError>> = {
  platform: PlatformError,
  business: BusinessError,
  validation: ValidationError,
  authentication: AuthenticationError,
  authorization: AuthorizationError,
  infrastructure: InfrastructureError,
  configuration: ConfigurationError,
  workflow: WorkflowError,
  automation: AutomationError,
  plugin: PluginError,
  integration: IntegrationError,
  storage: StorageError,
  search: SearchError,
  ai: AIError,
  notification: NotificationError,
  scheduler: SchedulerError,
  security: SecurityError,
  unknown: UnknownError,
};

/** Instantiate the correct error class for a definition's category. */
export function createError(options: CreateErrorOptions): PlatformError {
  const Ctor = CLASS_BY_CATEGORY[options.definition.category];
  return new Ctor(options);
}

/** Type predicate: is this a platform error instance? */
export function isPlatformError(value: unknown): value is PlatformError {
  return value instanceof PlatformError;
}

export type { ErrorInit };