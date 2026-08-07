import { Logger, type LogSink } from '../factory';
import {
  LOGGER_ENGINE_VERSION,
  LOG_CATEGORIES,
  LOG_LEVELS,
  LOG_LEVEL_RANK,
} from '../metadata';
import { buildSnapshot } from '../snapshot';
import type {
  LogCategory,
  LogContext,
  LogEntry,
  LogLevel,
  LoggerDefinition,
  LoggerSnapshot,
} from '../types';

/** Bounded in-memory ring buffer for entry snapshots (no persistence here). */
const DEFAULT_RETAINED_ENTRIES = 1000;

export class LoggerEngine implements LogSink {
  readonly version = LOGGER_ENGINE_VERSION;
  private readonly loggers = new Map<string, Logger>();
  private readonly retainedEntries: LogEntry[] = [];
  private readonly maxRetained: number;
  private readonly minLevel: LogLevel;
  private readonly sink: LogSink;

  constructor(options?: {
    minLevel?: LogLevel;
    maxRetained?: number;
    /** Optional external sink (e.g. a future shipping leg). */
    sink?: LogSink;
  }, levelFromConfig?: (key: string) => LogLevel | undefined) {
    this.maxRetained = options?.maxRetained ?? DEFAULT_RETAINED_ENTRIES;
    this.minLevel =
      options?.minLevel ??
      levelFromConfig?.('logging.level') ??
      'info';
    this.sink = options?.sink ?? this;
  }

  // ── LogSink (default in-memory buffer) ────────────────────────────────────

  /** Buffer entries up to the retention cap. */
  onEntry(entry: LogEntry): void {
    this.retainedEntries.push(entry);
    if (this.retainedEntries.length > this.maxRetained) {
      this.retainedEntries.shift();
    }
  }

  // ── Logger factory ────────────────────────────────────────────────────────

  /** Register or return a named logger. */
  logger(name: string, options?: { category?: LogCategory; context?: LogContext; minLevel?: LogLevel }): Logger {
    const existing = this.loggers.get(name);
    if (existing) {
      return existing;
    }
    const logger = new Logger({
      name,
      category: options?.category ?? 'application',
      context: options?.context,
      minLevel: options?.minLevel ?? this.minLevel,
      sink: this.sink,
    });
    this.loggers.set(name, logger);
    return logger;
  }

  /** A logger scoped to a specific category. */
  category(category: LogCategory, context?: LogContext): Logger {
    return this.logger(`category:${category}`, { category, context });
  }

  /** A child logger under a parent name with extra context. */
  child(parentName: string, context: LogContext): Logger {
    const parent = this.loggers.get(parentName);
    const base = parent ?? this.logger(parentName);
    return base.child(context);
  }

  /** Whether a level would be emitted. */
  isEnabled(level: LogLevel): boolean {
    return LOG_LEVEL_RANK[level] >= LOG_LEVEL_RANK[this.minLevel];
  }

  // ── Public utility ────────────────────────────────────────────────────────

  /** Most recent buffered entries (copy, newest first). */
  recent(): readonly LogEntry[] {
    return [...this.retainedEntries].reverse();
  }

  levels(): readonly { key: LogLevel; rank: number }[] {
    return LOG_LEVELS.map((key) => ({ key, rank: LOG_LEVEL_RANK[key] }));
  }

  categories(): readonly { key: LogCategory; count: number }[] {
    return LOG_CATEGORIES.map((key) => ({
      key,
      count: this.retainedEntries.filter((entry) => entry.category === key).length,
    }));
  }

  catalog(): readonly LoggerDefinition[] {
    return [...this.loggers.values()].map((logger) => ({
      name: logger.name,
      category: logger.category,
    }));
  }

  /** Copy of the current logging threshold. */
  get threshold(): LogLevel {
    return this.minLevel;
  }

  /** Immutable snapshot of the logger registry. */
  snapshot(): LoggerSnapshot {
    return buildSnapshot(this.catalog());
  }

  /** Number of registered loggers. */
  get size(): number {
    return this.loggers.size;
  }
}

/** Default logger engine instance. */
export const loggerEngine: LoggerEngine = new LoggerEngine();