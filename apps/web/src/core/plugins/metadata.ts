import type { PluginStatus } from './types';

/** Current plugin schema version. */
export const PLUGIN_VERSION = '1.0.0';

/** All supported plugin lifecycle statuses. */
export const PLUGIN_STATUSES: readonly PluginStatus[] = [
  'registered',
  'resolving',
  'initializing',
  'active',
  'inactive',
  'failed',
  'uninstalled',
];

/** Normalize a SemVer string into [major, minor, patch]. */
export function parseSemVer(version: string): readonly [number, number, number] {
  const [major = '0', minor = '0', patch = '0'] = version.replace(/^[vV]/, '').split(/[.-]/, 3);
  return [Number(major) || 0, Number(minor) || 0, Number(patch) || 0];
}

/** Compare two SemVer strings; -1/0/1. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const [am, ai, ap] = parseSemVer(a);
  const [bm, bi, bp] = parseSemVer(b);
  if (am !== bm) return am < bm ? -1 : 1;
  if (ai !== bi) return ai < bi ? -1 : 1;
  if (ap !== bp) return ap < bp ? -1 : 1;
  return 0;
}

/**
 * Whether `version` satisfies a SemVer range. Supports `^`, `~`, `>=`, `<=`,
 * `>`, `<`, `=`, and `x` wildcards in a single comparison.
 */
export function satisfiesRange(version: string, range: string): boolean {
  return range
    .split(/\s+/)
    .filter(Boolean)
    .every((part) => {
      if (part === '*') return true;
      const match = /^(<=|>=|<|>|=|\^|~)?\s*v?(\d+\.\d+\.\d+|\d+\.\d+|\d+|\*)(\.\d+)?$/.exec(part);
      if (!match) return false;
      const operator = (match[1] ?? '=') as '=' | '^' | '~' | '>=' | '<=' | '>' | '<';
      const base = match[2];
      const [vm, vi, vp] = parseSemVer(base);
      if (operator === '=') return compareVersions(version, `${vm}.${vi}.${vp}`) === 0;
      if (operator === '>=') return compareVersions(version, `${vm}.${vi}.${vp}`) >= 0;
      if (operator === '<=') return compareVersions(version, `${vm}.${vi}.${vp}`) <= 0;
      if (operator === '>') return compareVersions(version, `${vm}.${vi}.${vp}`) > 0;
      if (operator === '<') return compareVersions(version, `${vm}.${vi}.${vp}`) < 0;
      if (operator === '~') {
        return compareVersions(version, `${vm}.${vi}.${vp}`) >= 0 &&
          compareVersions(version, `${vm}.${vi + 1}.0`) < 0;
      }
      if (operator === '^') {
        const upperMinor = vm === 0 ? vi + 1 : 0;
        const upper = vm === 0 ? `${vm}.${upperMinor}.0` : `${vm + 1}.0.0`;
        return compareVersions(version, `${vm}.${vi}.${vp}`) >= 0 && compareVersions(version, upper) < 0;
      }
      return false;
    });
}