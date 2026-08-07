import { LOGGER_ENGINE_VERSION } from '../metadata';
import type { LoggerDefinition, LoggerSnapshot } from '../types';

/** Build an immutable snapshot of the registered loggers. */
export function buildSnapshot(
  loggers: readonly LoggerDefinition[],
): LoggerSnapshot {
  return {
    version: LOGGER_ENGINE_VERSION,
    takenAt: new Date().toISOString(),
    logger: Object.freeze([...loggers]),
  };
}