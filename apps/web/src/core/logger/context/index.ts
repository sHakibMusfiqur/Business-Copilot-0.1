import type { LogContext } from '../types';

/** Merge two contexts; child values override parent, tags/metadata combine. */
export function mergeContext(
  parent: LogContext | undefined,
  child: LogContext | undefined,
): LogContext {
  if (!child) {
    return parent ?? {};
  }
  const base = parent ?? {};
  const merged: LogContext = { ...base, ...child };

  if (child.tags || base.tags) {
    merged.tags = [...(base.tags ?? []), ...(child.tags ?? [])];
  }
  if (child.metadata || base.metadata) {
    merged.metadata = { ...(base.metadata ?? {}), ...(child.metadata ?? {}) };
  }
  return merged;
}