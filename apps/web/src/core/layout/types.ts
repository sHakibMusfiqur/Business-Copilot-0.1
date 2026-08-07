export type LayoutMode = 'side' | 'top';

export interface LayoutRegions {
  sidebar: boolean;
  topbar: boolean;
  commandPalette: boolean;
  aiDock: boolean;
}

export interface LayoutSpec {
  mode: LayoutMode;
  regions: LayoutRegions;
  /** 12-column grid used by workspace widgets. */
  columns: number;
  /** Max content width in px (0 = fluid). */
  maxWidth: number;
  sidebarWidth: number;
  sidebarCollapsedWidth: number;
  mobileBreakpoint: number;
  workspaceClassName?: string;
}

export interface LayoutDefinition {
  id: string;
  label: string;
  spec: LayoutSpec;
}
