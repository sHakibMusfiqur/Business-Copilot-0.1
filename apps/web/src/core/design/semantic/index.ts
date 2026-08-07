import type { DesignToken } from '../types';

export const SEMANTIC_TOKENS: readonly DesignToken[] = [
  // Text
  { id: 'semantic.text.default', name: 'Text Default', category: 'semantic', group: 'color', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['semantic', 'text'], value: '{color.foreground}' },
  { id: 'semantic.text.muted', name: 'Text Muted', category: 'semantic', group: 'color', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['semantic', 'text'], value: '{color.mutedForeground}' },
  { id: 'semantic.text.inverse', name: 'Text Inverse', category: 'semantic', group: 'color', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['semantic', 'text'], value: '{color.primaryForeground}' },
  { id: 'semantic.text.link', name: 'Text Link', category: 'semantic', group: 'color', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['semantic', 'text'], value: '{color.primary}' },
  { id: 'semantic.text.error', name: 'Text Error', category: 'semantic', group: 'color', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['semantic', 'text', 'status'], value: '{color.destructive}' },

  // Surface
  { id: 'semantic.surface.page', name: 'Surface Page', category: 'semantic', group: 'surface', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['semantic', 'surface'], value: '{color.background}' },
  { id: 'semantic.surface.card', name: 'Surface Card', category: 'semantic', group: 'surface', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['semantic', 'surface'], value: '{color.card}' },
  { id: 'semantic.surface.subtle', name: 'Surface Subtle', category: 'semantic', group: 'surface', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['semantic', 'surface'], value: '{color.muted}' },
  { id: 'semantic.surface.sidebar', name: 'Surface Sidebar', category: 'semantic', group: 'surface', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['semantic', 'surface'], value: '{surface.sidebar}' },

  // Interactive
  { id: 'semantic.action.primary', name: 'Action Primary', category: 'semantic', group: 'color', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['semantic', 'action'], configKey: 'design.primaryColor', value: '{color.primary}' },
  { id: 'semantic.action.primaryForeground', name: 'Action Primary Foreground', category: 'semantic', group: 'color', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['semantic', 'action'], value: '{color.primaryForeground}' },
  { id: 'semantic.action.hover', name: 'Action Hover', category: 'semantic', group: 'color', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['semantic', 'action'], value: '{color.accent}' },
  { id: 'semantic.action.danger', name: 'Action Danger', category: 'semantic', group: 'color', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['semantic', 'action'], value: '{color.destructive}' },
  { id: 'semantic.focus.ring', name: 'Focus Ring', category: 'semantic', group: 'color', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['semantic', 'focus'], value: '{color.ring}' },

  // Border
  { id: 'semantic.border.default', name: 'Border Default', category: 'semantic', group: 'border', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['semantic', 'border'], value: '{color.border}' },
  { id: 'semantic.border.strong', name: 'Border Strong', category: 'semantic', group: 'border', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['semantic', 'border'], value: '{color.foreground}' },

  // Status
  { id: 'semantic.status.success', name: 'Status Success', category: 'semantic', group: 'color', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['semantic', 'status'], value: 'hsl(var(--success))' },
  { id: 'semantic.status.warning', name: 'Status Warning', category: 'semantic', group: 'color', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['semantic', 'status'], value: 'hsl(var(--warning))' },
  { id: 'semantic.status.error', name: 'Status Error', category: 'semantic', group: 'color', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['semantic', 'status'], value: '{color.destructive}' },
  { id: 'semantic.status.neutral', name: 'Status Neutral', category: 'semantic', group: 'color', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['semantic', 'status'], value: '{color.mutedForeground}' },
  { id: 'semantic.status.info', name: 'Status Info', category: 'semantic', group: 'color', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['semantic', 'status'], value: '{color.primary}' },

  // Elevation aliases
  { id: 'semantic.elevation.card', name: 'Elevation Card', category: 'semantic', group: 'elevation', type: 'shadow', version: '1.0.0', owner: 'design-system', tags: ['semantic', 'elevation'], value: '{elevation.1}' },
  { id: 'semantic.elevation.popover', name: 'Elevation Popover', category: 'semantic', group: 'elevation', type: 'shadow', version: '1.0.0', owner: 'design-system', tags: ['semantic', 'elevation'], value: '{elevation.3}' },
  { id: 'semantic.elevation.modal', name: 'Elevation Modal', category: 'semantic', group: 'elevation', type: 'shadow', version: '1.0.0', owner: 'design-system', tags: ['semantic', 'elevation'], value: '{elevation.4}' },

  // Density
  { id: 'semantic.density.compact', name: 'Density Compact', category: 'semantic', group: 'density', type: 'string', version: '1.0.0', owner: 'design-system', tags: ['semantic', 'density'], value: '{density.compact}' },

  // Accessibility
  { id: 'semantic.focus.offset', name: 'Focus Offset', category: 'semantic', group: 'opacity', type: 'size', version: '1.0.0', owner: 'design-system', tags: ['accessibility'], value: '2px' },
  { id: 'semantic.minTarget', name: 'Minimum Target Size', category: 'semantic', group: 'spacing', type: 'size', version: '1.0.0', owner: 'design-system', tags: ['accessibility'], value: '44px' },
  { id: 'semantic.contrast.normalText', name: 'Contrast Normal Text', category: 'semantic', group: 'color', type: 'number', version: '1.0.0', owner: 'design-system', tags: ['accessibility'], value: 4.5 },
  { id: 'semantic.contrast.largeText', name: 'Contrast Large Text', category: 'semantic', group: 'color', type: 'number', version: '1.0.0', owner: 'design-system', tags: ['accessibility'], value: 3 },
] as const satisfies readonly DesignToken[];

/** Lookup helper over the semantic set. */
export const SEMANTIC_TOKENS_BY_ID: ReadonlyMap<string, DesignToken> = new Map(
  SEMANTIC_TOKENS.map((token) => [token.id, token]),
);