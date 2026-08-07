import type { DesignToken } from '../types';


export const LAYOUT_TOKENS: readonly DesignToken[] = [
  // Breakpoints (max widths, mobile-first)
  { id: 'layout.breakpoint.sm', name: 'Breakpoint SM', category: 'layout', group: 'breakpoint', type: 'breakpoint', version: '1.0.0', owner: 'design-system', tags: ['layout', 'breakpoint'], value: '640px' },
  { id: 'layout.breakpoint.md', name: 'Breakpoint MD', category: 'layout', group: 'breakpoint', type: 'breakpoint', version: '1.0.0', owner: 'design-system', tags: ['layout', 'breakpoint'], value: '768px' },
  { id: 'layout.breakpoint.lg', name: 'Breakpoint LG', category: 'layout', group: 'breakpoint', type: 'breakpoint', version: '1.0.0', owner: 'design-system', tags: ['layout', 'breakpoint'], value: '1024px' },
  { id: 'layout.breakpoint.xl', name: 'Breakpoint XL', category: 'layout', group: 'breakpoint', type: 'breakpoint', version: '1.0.0', owner: 'design-system', tags: ['layout', 'breakpoint'], value: '1280px' },
  { id: 'layout.breakpoint.wide', name: 'Breakpoint Wide', category: 'layout', group: 'breakpoint', type: 'breakpoint', version: '1.0.0', owner: 'design-system', tags: ['layout', 'breakpoint'], value: '1536px' },

  // Grid
  { id: 'layout.grid.columns', name: 'Grid Columns', category: 'layout', group: 'grid', type: 'grid', version: '1.0.0', owner: 'design-system', tags: ['layout', 'grid'], value: '12' },
  { id: 'layout.grid.gap', name: 'Grid Gap', category: 'layout', group: 'grid', type: 'spacing', version: '1.0.0', owner: 'design-system', tags: ['layout', 'grid'], value: '{spacing.md}' },
  { id: 'layout.grid.gapDense', name: 'Grid Gap Dense', category: 'layout', group: 'grid', type: 'spacing', version: '1.0.0', owner: 'design-system', tags: ['layout', 'grid', 'experimental'], experimental: true, value: '{spacing.sm}' },

  // Layout
  { id: 'layout.maxWidth', name: 'Max Content Width', category: 'layout', group: 'layout', type: 'size', version: '1.0.0', owner: 'design-system', tags: ['layout'], value: '1536px' },
  { id: 'layout.sidebarWidth', name: 'Sidebar Width', category: 'layout', group: 'layout', type: 'size', version: '1.0.0', owner: 'design-system', tags: ['layout', 'navigation'], value: '16rem' },
  { id: 'layout.headerHeight', name: 'Header Height', category: 'layout', group: 'layout', type: 'size', version: '1.0.0', owner: 'design-system', tags: ['layout', 'navigation'], value: '4rem' },
  { id: 'layout.contentPadding', name: 'Content Padding', category: 'layout', group: 'layout', type: 'spacing', version: '1.0.0', owner: 'design-system', tags: ['layout'], value: '{spacing.md}' },
] as const satisfies readonly DesignToken[];

/** Lookup helper over the layout set. */
export const LAYOUT_TOKENS_BY_ID: ReadonlyMap<string, DesignToken> = new Map(
  LAYOUT_TOKENS.map((token) => [token.id, token]),
);