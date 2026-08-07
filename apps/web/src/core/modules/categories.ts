import type { ModuleCategory } from './types';

/** Category order + labels. Navigation groups render in this order. */
export const MODULE_CATEGORIES: readonly ModuleCategory[] = [
  'Workspace',
  'Relations',
  'Operations',
  'Finance',
  'People',
  'Administration',
  'Analytics',
];

/** Modules that surface at the top of the sidebar as favorites. */
export const DEFAULT_FAVORITES: readonly string[] = [
  'dashboard',
  'customers',
  'accounting',
];
