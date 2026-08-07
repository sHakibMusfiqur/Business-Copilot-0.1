import type { LogCategory, LogLevel } from './types';

/** All supported log levels, ordered (index = verbosity). */
export const LOG_LEVELS: readonly LogLevel[] = [
  'trace',
  'debug',
  'info',
  'notice',
  'warning',
  'error',
  'critical',
  'fatal',
];

/** Rank used for level filtering (higher = more severe). */
export const LOG_LEVEL_RANK: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  notice: 3,
  warning: 4,
  error: 5,
  critical: 6,
  fatal: 7,
};

/** All supported log categories. */
export const LOG_CATEGORIES: readonly LogCategory[] = [
  'platform',
  'application',
  'business',
  'security',
  'authentication',
  'authorization',
  'workflow',
  'automation',
  'integration',
  'plugin',
  'ai',
  'infrastructure',
  'configuration',
  'database',
  'network',
  'storage',
  'search',
  'notification',
  'scheduler',
  'audit',
  'unknown',
];

/** Current logger engine schema version. */
export const LOGGER_ENGINE_VERSION = '1.0.0';

/** Log level descriptor surfaced via `levels()`. */
export interface LogLevelDescriptor {
  key: LogLevel;
  rank: number;
}

/** Log category descriptor surfaced via `categories()`. */
export interface LogCategoryDescriptor {
  key: LogCategory;
  count: number;
}

/** Rank of a level for threshold comparisons. */
export function levelRank(level: LogLevel): number {
  return LOG_LEVEL_RANK[level];
}