import { mergeContext } from '../context';
import { LOGGER_ENGINE_VERSION, LOG_LEVEL_RANK, LOG_LEVELS } from '../metadata';
import type { LogCategory, LogContext, LogEntry, LogLevel } from '../types';

/** Sink interface the registry implements to receive emitted entries. */
export interface LogSink {
  onEntry(entry: LogEntry): void;
}

/** Options for constructing a logger. */
export interface LoggerOptions {
  name: string;
  category: LogCategory;
  /** Inherited context merged into every entry. */
  context?: LogContext;
  /** Minimum level to accept (inclusive). */
  minLevel?: LogLevel;
  owner?: string;
  domain?: string;
  sink: LogSink;
}

export class Logger {
  readonly name: string;
  readonly category: LogCategory;
  readonly context: LogContext;
  readonly owner?: string;
  readonly domain?: string;
  readonly minLevel: LogLevel;
  private readonly sink: LogSink;

  constructor(options: LoggerOptions) {
    this.name = options.name;
    this.category = options.category;
    this.context = options.context ?? {};
    this.owner = options.owner;
    this.domain = options.domain;
    this.minLevel = options.minLevel ?? 'info';
    this.sink = options.sink;
  }

  /** Whether a level would be emitted at the current threshold. */
  isEnabled(level: LogLevel): boolean {
    return LOG_LEVEL_RANK[level] >= LOG_LEVEL_RANK[this.minLevel];
  }

  // ── Derive ────────────────────────────────────────────────────────────────

  /** Returns a child logger that also carries extra context. */
  child(context: LogContext = {}, category: LogCategory = this.category): Logger {
    return new Logger({
      name: `${this.name}.child`,
      category,
      context: mergeContext(this.context, context),
      minLevel: this.minLevel,
      owner: this.owner,
      domain: this.domain,
      sink: this.sink,
    });
  }

  /** Returns a shallow copy logger with additional context. */
  withContext(context: LogContext): Logger {
    return new Logger({
      name: this.name,
      category: this.category,
      context: mergeContext(this.context, context),
      minLevel: this.minLevel,
      owner: this.owner,
      domain: this.domain,
      sink: this.sink,
    });
  }

  // ── Emission ──────────────────────────────────────────────────────────────

  log(level: LogLevel, message: string, context?: LogContext, error?: unknown): void {
    if (!this.isEnabled(level)) {
      return;
    }
    const errorMeta = errorToMetadata(error);
    this.sink.onEntry({
      id: nextId(),
      timestamp: new Date().toISOString(),
      level,
      levelRank: LOG_LEVEL_RANK[level],
      category: this.category,
      message,
      context: mergeContext(this.context, context),
      error: errorMeta,
      owner: this.owner,
      version: LOGGER_ENGINE_VERSION,
      domain: this.domain,
    });
  }

  trace(message: string, context?: LogContext, error?: unknown): void {
    this.log('trace', message, context, error);
  }
  debug(message: string, context?: LogContext, error?: unknown): void {
    this.log('debug', message, context, error);
  }
  info(message: string, context?: LogContext, error?: unknown): void {
    this.log('info', message, context, error);
  }
  notice(message: string, context?: LogContext, error?: unknown): void {
    this.log('notice', message, context, error);
  }
  warn(message: string, context?: LogContext, error?: unknown): void {
    this.log('warning', message, context, error);
  }
  error(message: string, context?: LogContext, error?: unknown): void {
    this.log('error', message, context, error);
  }
  critical(message: string, context?: LogContext, error?: unknown): void {
    this.log('critical', message, context, error);
  }
  fatal(message: string, context?: LogContext, error?: unknown): void {
    this.log('fatal', message, context, error);
  }
}

/** Convert a caught value to metadata. Preserves PlatformError metadata. */
function errorToMetadata(error: unknown): Readonly<Record<string, unknown>> | undefined {
  if (error === undefined || error === null) {
    return undefined;
  }

  const asAny = error as { toMetadata?: () => Readonly<Record<string, unknown>> };
  if (typeof asAny.toMetadata === 'function') {
    const meta = asAny.toMetadata();
    return { ...meta, code: (error as { code?: unknown }).code };
  }
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack, name: error.name };
  }
  return { value: String(error) };
}

/** Generated unique id. */
let counter = 0;
function nextId(): string {
  counter += 1;
  return `log-${Date.now()}-${counter}`;
}

/** Re-export the level/category ordering helpers consumers may want. */
export { LOG_LEVELS, LOG_LEVEL_RANK };