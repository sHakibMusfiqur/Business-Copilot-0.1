/** Enterprise Logger Engine — public surface. */
export { LoggerEngine, loggerEngine } from './registry';
export { Logger } from './factory';
export type { LogSink, LoggerOptions } from './factory';
export {
  LOG_LEVELS,
  LOG_LEVEL_RANK,
  LOG_CATEGORIES,
  LOGGER_ENGINE_VERSION,
  levelRank,
} from './metadata';
export { mergeContext } from './context';
export { buildSnapshot } from './snapshot';
export type { LogLevelDescriptor, LogCategoryDescriptor } from './metadata';
export type {
  LogLevel,
  LogCategory,
  LogContext,
  LogEntry,
  LoggerDefinition,
  LoggerSnapshot,
} from './types';