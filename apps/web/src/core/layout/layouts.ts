import type { LayoutDefinition, LayoutMode } from './types';

const EXECUTIVE: LayoutDefinition = {
  id: 'executive',
  label: 'Executive',
  spec: {
    mode: 'side',
    regions: { sidebar: true, topbar: true, commandPalette: true, aiDock: true },
    columns: 12,
    maxWidth: 0,
    sidebarWidth: 256,
    sidebarCollapsedWidth: 72,
    mobileBreakpoint: 1024,
    workspaceClassName: 'executive-workspace',
  },
};

const MANAGER: LayoutDefinition = {
  id: 'manager',
  label: 'Manager',
  spec: {
    mode: 'side',
    regions: { sidebar: true, topbar: true, commandPalette: true, aiDock: true },
    columns: 12,
    maxWidth: 0,
    sidebarWidth: 256,
    sidebarCollapsedWidth: 72,
    mobileBreakpoint: 1024,
    workspaceClassName: 'manager-workspace',
  },
};

const STAFF: LayoutDefinition = {
  id: 'staff',
  label: 'Staff',
  spec: {
    mode: 'side',
    regions: { sidebar: true, topbar: true, commandPalette: true, aiDock: false },
    columns: 12,
    maxWidth: 0,
    sidebarWidth: 240,
    sidebarCollapsedWidth: 72,
    mobileBreakpoint: 1024,
    workspaceClassName: 'staff-workspace',
  },
};

const MOBILE: LayoutDefinition = {
  id: 'mobile',
  label: 'Mobile',
  spec: {
    mode: 'top',
    regions: { sidebar: false, topbar: true, commandPalette: true, aiDock: false },
    columns: 12,
    maxWidth: 0,
    sidebarWidth: 0,
    sidebarCollapsedWidth: 0,
    mobileBreakpoint: 1024,
    workspaceClassName: 'mobile-workspace',
  },
};

/** Ordered layout definitions. First entry is the platform default. */
export const LAYOUTS: LayoutDefinition[] = [EXECUTIVE, MANAGER, STAFF, MOBILE];

export const LAYOUT_BY_ID: Record<string, LayoutDefinition> = Object.fromEntries(
  LAYOUTS.map((l) => [l.id, l]),
);

export const DEFAULT_LAYOUT_ID = LAYOUTS[0].id;

export type { LayoutMode };
