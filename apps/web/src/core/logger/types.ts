/** Severity level of a log entry, ordered from most to least verbose. */
export type LogLevel =
  | 'trace'
  | 'debug'
  | 'info'
  | 'notice'
  | 'warning'
  | 'error'
  | 'critical'
  | 'fatal';

/** Functional category a log entry belongs to. */
export type LogCategory =
  | 'platform'
  | 'application'
  | 'business'
  | 'security'
  | 'authentication'
  | 'authorization'
  | 'workflow'
  | 'automation'
  | 'integration'
  | 'plugin'
  | 'ai'
  | 'infrastructure'
  | 'configuration'
  | 'database'
  | 'network'
  | 'storage'
  | 'search'
  | 'notification'
  | 'scheduler'
  | 'audit'
  | 'unknown';

/** Structured context attached to a logger and inherited by its entries. */
export interface LogContext {
  requestId?: string;
  correlationId?: string;
  sessionId?: string;
  organizationId?: string;
  workspaceId?: string;
  tenantId?: string;
  userId?: string;
  featureId?: string;
  moduleId?: string;
  pluginId?: string;
  workflowId?: string;
  aiAgentId?: string;
  tags?: readonly string[];
  metadata?: Readonly<Record<string, unknown>>;
}

/** A single emitted log entry. Immutable by convention. */
export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  context: LogContext;
  /** Optional platform error metadata preserved when logging errors. */
  error?: Readonly<Record<string, unknown>>;
  owner?: string;
  version: string;
  domain?: string;
  /** Relative ordering helper for level filtering. */
  levelRank: number;
}

/** Static metadata for a named logger or category logger. */
export interface LoggerDefinition {
  name: string;
  category: LogCategory;
}

/** Immutable snapshot of the logger registry at a point in time. */
export interface LoggerSnapshot {
  version: string;
  takenAt: string;
  logger: readonly LoggerDefinition[];
}