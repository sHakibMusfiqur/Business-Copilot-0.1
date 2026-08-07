import type { DesignToken, TokenGroup, TokenValue } from '../types';

export const FOUNDATION_TOKENS: readonly DesignToken[] = [
  // ── Color ────────────────────────────────────────────────────────────────
  { id: 'color.background', name: 'Background', category: 'foundation', group: 'color', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['palette'], value: 'hsl(var(--background))' },
  { id: 'color.foreground', name: 'Foreground', category: 'foundation', group: 'color', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['palette'], value: 'hsl(var(--foreground))' },
  { id: 'color.card', name: 'Card', category: 'foundation', group: 'color', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['palette'], value: 'hsl(var(--card))' },
  { id: 'color.primary', name: 'Primary', category: 'foundation', group: 'color', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['palette', 'brand'], value: 'hsl(var(--primary))' },
  { id: 'color.primaryForeground', name: 'Primary Foreground', category: 'foundation', group: 'color', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['palette'], value: 'hsl(var(--primary-foreground))' },
  { id: 'color.muted', name: 'Muted', category: 'foundation', group: 'color', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['palette'], value: 'hsl(var(--muted))' },
  { id: 'color.mutedForeground', name: 'Muted Foreground', category: 'foundation', group: 'color', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['palette'], value: 'hsl(var(--muted-foreground))' },
  { id: 'color.accent', name: 'Accent', category: 'foundation', group: 'color', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['palette'], value: 'hsl(var(--accent))' },
  { id: 'color.border', name: 'Border', category: 'foundation', group: 'color', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['palette'], value: 'hsl(var(--border))' },
  { id: 'color.destructive', name: 'Destructive', category: 'foundation', group: 'color', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['palette', 'status'], value: 'hsl(var(--destructive))' },
  { id: 'color.ring', name: 'Ring', category: 'foundation', group: 'color', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['palette', 'focus'], value: 'hsl(var(--ring))' },

  // ── Surface ──────────────────────────────────────────────────────────────
  { id: 'surface.sidebar', name: 'Sidebar Surface', category: 'foundation', group: 'surface', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['surface'], value: 'hsl(var(--sidebar-background))' },
  { id: 'surface.sidebarForeground', name: 'Sidebar Foreground', category: 'foundation', group: 'surface', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['surface'], value: 'hsl(var(--sidebar-foreground))' },
  { id: 'surface.sidebarMuted', name: 'Sidebar Muted', category: 'foundation', group: 'surface', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['surface'], value: 'hsl(var(--sidebar-muted))' },
  { id: 'surface.sidebarAccent', name: 'Sidebar Accent', category: 'foundation', group: 'surface', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['surface'], value: 'hsl(var(--sidebar-accent))' },
  { id: 'surface.sidebarBorder', name: 'Sidebar Border', category: 'foundation', group: 'surface', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['surface'], value: 'hsl(var(--sidebar-border))' },

  // ── Elevation / shadow ───────────────────────────────────────────────────
  { id: 'elevation.1', name: 'Elevation 1', category: 'foundation', group: 'elevation', type: 'shadow', version: '1.0.0', owner: 'design-system', tags: ['elevation'], value: '0 1px 3px 0 rgb(0 0 0 / 0.08)' },
  { id: 'elevation.2', name: 'Elevation 2', category: 'foundation', group: 'elevation', type: 'shadow', version: '1.0.0', owner: 'design-system', tags: ['elevation'], value: '0 1px 2px 0 rgb(0 0 0 / 0.05)' },
  { id: 'elevation.3', name: 'Elevation 3', category: 'foundation', group: 'elevation', type: 'shadow', version: '1.0.0', owner: 'design-system', tags: ['elevation'], value: '0 4px 6px -1px rgb(0 0 0 / 0.1)' },
  { id: 'elevation.4', name: 'Elevation 4', category: 'foundation', group: 'elevation', type: 'shadow', version: '1.0.0', owner: 'design-system', tags: ['elevation'], value: '0 10px 15px -3px rgb(0 0 0 / 0.1)' },
  { id: 'shadow.sm', name: 'Shadow Small', category: 'foundation', group: 'shadow', type: 'shadow', version: '1.0.0', owner: 'design-system', tags: ['shadow'], value: '0 1px 2px 0 rgb(0 0 0 / 0.05)' },
  { id: 'shadow.md', name: 'Shadow Medium', category: 'foundation', group: 'shadow', type: 'shadow', version: '1.0.0', owner: 'design-system', tags: ['shadow'], value: '0 4px 6px -1px rgb(0 0 0 / 0.1)' },
  { id: 'shadow.lg', name: 'Shadow Large', category: 'foundation', group: 'shadow', type: 'shadow', version: '1.0.0', owner: 'design-system', tags: ['shadow'], value: '0 10px 15px -3px rgb(0 0 0 / 0.1)' },
  { id: 'shadow.card', name: 'Shadow Card', category: 'foundation', group: 'shadow', type: 'shadow', version: '1.0.0', owner: 'design-system', tags: ['shadow'], value: '0 1px 3px 0 rgb(0 0 0 / 0.08)' },

  // ── Glass ────────────────────────────────────────────────────────────────
  { id: 'glass.background', name: 'Glass Background', category: 'foundation', group: 'glass', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['glass', 'experimental'], experimental: true, value: 'hsl(var(--glass-background))' },
  { id: 'glass.blur', name: 'Glass Blur', category: 'foundation', group: 'glass', type: 'blur', version: '1.0.0', owner: 'design-system', tags: ['glass', 'experimental'], experimental: true, value: '16px' },
  { id: 'glass.border', name: 'Glass Border', category: 'foundation', group: 'glass', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['glass', 'experimental'], experimental: true, value: 'hsl(var(--glass-border))' },

  // ── Radius ───────────────────────────────────────────────────────────────
  { id: 'radius.sm', name: 'Radius Small', category: 'foundation', group: 'radius', type: 'radius', version: '1.0.0', owner: 'design-system', tags: ['radius'], value: '0.375rem' },
  { id: 'radius.md', name: 'Radius Medium', category: 'foundation', group: 'radius', type: 'radius', version: '1.0.0', owner: 'design-system', tags: ['radius'], value: '0.5rem' },
  { id: 'radius.lg', name: 'Radius Large', category: 'foundation', group: 'radius', type: 'radius', version: '1.0.0', owner: 'design-system', tags: ['radius'], value: '0.75rem' },
  { id: 'radius.xl', name: 'Radius Extra Large', category: 'foundation', group: 'radius', type: 'radius', version: '1.0.0', owner: 'design-system', tags: ['radius'], value: '1rem' },
  { id: 'radius.full', name: 'Radius Full', category: 'foundation', group: 'radius', type: 'radius', version: '1.0.0', owner: 'design-system', tags: ['radius'], value: '9999px' },

  // ── Border ───────────────────────────────────────────────────────────────
  { id: 'border.width', name: 'Border Width', category: 'foundation', group: 'border', type: 'size', version: '1.0.0', owner: 'design-system', tags: ['border'], value: '1px' },
  { id: 'border.color', name: 'Border Color', category: 'foundation', group: 'border', type: 'color', version: '1.0.0', owner: 'design-system', tags: ['border'], value: '{color.border}' },

  // ── Typography ───────────────────────────────────────────────────────────
  { id: 'font.family', name: 'Font Family', category: 'foundation', group: 'typography', type: 'string', version: '1.0.0', owner: 'design-system', tags: ['typography'], value: 'var(--font-sans, ui-sans-serif, system-ui, sans-serif)' },
  { id: 'font.familyMono', name: 'Font Family Mono', category: 'foundation', group: 'typography', type: 'string', version: '1.0.0', owner: 'design-system', tags: ['typography'], value: 'var(--font-mono, ui-monospace, monospace)' },

  // Font scale (mirrors the existing tailwind font scale)
  { id: 'font.xs', name: 'Font XS', category: 'foundation', group: 'font-scale', type: 'size', version: '1.0.0', owner: 'design-system', tags: ['font-scale'], value: '0.75rem' },
  { id: 'font.sm', name: 'Font SM', category: 'foundation', group: 'font-scale', type: 'size', version: '1.0.0', owner: 'design-system', tags: ['font-scale'], value: '0.875rem' },
  { id: 'font.base', name: 'Font Base', category: 'foundation', group: 'font-scale', type: 'size', version: '1.0.0', owner: 'design-system', tags: ['font-scale'], value: '1rem' },
  { id: 'font.lg', name: 'Font LG', category: 'foundation', group: 'font-scale', type: 'size', version: '1.0.0', owner: 'design-system', tags: ['font-scale'], value: '1.125rem' },
  { id: 'font.xl', name: 'Font XL', category: 'foundation', group: 'font-scale', type: 'size', version: '1.0.0', owner: 'design-system', tags: ['font-scale'], value: '1.25rem' },
  { id: 'font.2xl', name: 'Font 2XL', category: 'foundation', group: 'font-scale', type: 'size', version: '1.0.0', owner: 'design-system', tags: ['font-scale'], value: '1.5rem' },
  { id: 'font.3xl', name: 'Font 3XL', category: 'foundation', group: 'font-scale', type: 'size', version: '1.0.0', owner: 'design-system', tags: ['font-scale'], value: '1.875rem' },
  { id: 'font.4xl', name: 'Font 4XL', category: 'foundation', group: 'font-scale', type: 'size', version: '1.0.0', owner: 'design-system', tags: ['font-scale'], value: '2.25rem' },

  // Line height
  { id: 'line-height.tight', name: 'Line Height Tight', category: 'foundation', group: 'line-height', type: 'number', version: '1.0.0', owner: 'design-system', tags: ['typography'], value: 1.25 },
  { id: 'line-height.normal', name: 'Line Height Normal', category: 'foundation', group: 'line-height', type: 'number', version: '1.0.0', owner: 'design-system', tags: ['typography'], value: 1.5 },
  { id: 'line-height.relaxed', name: 'Line Height Relaxed', category: 'foundation', group: 'line-height', type: 'number', version: '1.0.0', owner: 'design-system', tags: ['typography'], value: 1.75 },

  // Letter spacing
  { id: 'letter-spacing.tight', name: 'Letter Spacing Tight', category: 'foundation', group: 'letter-spacing', type: 'size', version: '1.0.0', owner: 'design-system', tags: ['typography'], value: '-0.025em' },
  { id: 'letter-spacing.normal', name: 'Letter Spacing Normal', category: 'foundation', group: 'letter-spacing', type: 'size', version: '1.0.0', owner: 'design-system', tags: ['typography'], value: '0em' },
  { id: 'letter-spacing.wide', name: 'Letter Spacing Wide', category: 'foundation', group: 'letter-spacing', type: 'size', version: '1.0.0', owner: 'design-system', tags: ['typography'], value: '0.025em' },

  // ── Spacing scale (mirrors existing tailwind spacing) ────────────────────
  { id: 'spacing.xs', name: 'Spacing XS', category: 'foundation', group: 'spacing', type: 'spacing', version: '1.0.0', owner: 'design-system', tags: ['spacing'], value: '0.5rem' },
  { id: 'spacing.sm', name: 'Spacing SM', category: 'foundation', group: 'spacing', type: 'spacing', version: '1.0.0', owner: 'design-system', tags: ['spacing'], value: '0.75rem' },
  { id: 'spacing.md', name: 'Spacing MD', category: 'foundation', group: 'spacing', type: 'spacing', version: '1.0.0', owner: 'design-system', tags: ['spacing'], value: '1rem' },
  { id: 'spacing.lg', name: 'Spacing LG', category: 'foundation', group: 'spacing', type: 'spacing', version: '1.0.0', owner: 'design-system', tags: ['spacing'], value: '1.5rem' },
  { id: 'spacing.xl', name: 'Spacing XL', category: 'foundation', group: 'spacing', type: 'spacing', version: '1.0.0', owner: 'design-system', tags: ['spacing'], value: '2rem' },
  { id: 'spacing.2xl', name: 'Spacing 2XL', category: 'foundation', group: 'spacing', type: 'spacing', version: '1.0.0', owner: 'design-system', tags: ['spacing'], value: '3rem' },
  { id: 'spacing.3xl', name: 'Spacing 3XL', category: 'foundation', group: 'spacing', type: 'spacing', version: '1.0.0', owner: 'design-system', tags: ['spacing'], value: '4rem' },

  // ── Icon size ─────────────────────────────────────────────────────────────
  { id: 'icon.sm', name: 'Icon SM', category: 'foundation', group: 'icon-size', type: 'size', version: '1.0.0', owner: 'design-system', tags: ['icon'], value: '1rem' },
  { id: 'icon.md', name: 'Icon MD', category: 'foundation', group: 'icon-size', type: 'size', version: '1.0.0', owner: 'design-system', tags: ['icon'], value: '1.25rem' },
  { id: 'icon.lg', name: 'Icon LG', category: 'foundation', group: 'icon-size', type: 'size', version: '1.0.0', owner: 'design-system', tags: ['icon'], value: '1.5rem' },

  // ── Density ───────────────────────────────────────────────────────────────
  { id: 'density.comfortable', name: 'Density Comfortable', category: 'foundation', group: 'density', type: 'string', version: '1.0.0', owner: 'design-system', tags: ['density'], value: 'comfortable' },
  { id: 'density.compact', name: 'Density Compact', category: 'foundation', group: 'density', type: 'string', version: '1.0.0', owner: 'design-system', tags: ['density'], value: 'compact' },

  // ── Opacity / blur ────────────────────────────────────────────────────────
  { id: 'opacity.subtle', name: 'Opacity Subtle', category: 'foundation', group: 'opacity', type: 'opacity', version: '1.0.0', owner: 'design-system', tags: ['opacity'], value: 0.5 },
  { id: 'opacity.disabled', name: 'Opacity Disabled', category: 'foundation', group: 'opacity', type: 'opacity', version: '1.0.0', owner: 'design-system', tags: ['opacity'], value: 0.4 },
  { id: 'blur.sm', name: 'Blur SM', category: 'foundation', group: 'blur', type: 'blur', version: '1.0.0', owner: 'design-system', tags: ['blur'], value: '4px' },
  { id: 'blur.md', name: 'Blur MD', category: 'foundation', group: 'blur', type: 'blur', version: '1.0.0', owner: 'design-system', tags: ['blur'], value: '8px' },
  { id: 'blur.lg', name: 'Blur LG', category: 'foundation', group: 'blur', type: 'blur', version: '1.0.0', owner: 'design-system', tags: ['blur'], value: '16px' },

  // ── Z-index ───────────────────────────────────────────────────────────────
  { id: 'z-index.base', name: 'Z-Index Base', category: 'foundation', group: 'z-index', type: 'number', version: '1.0.0', owner: 'design-system', tags: ['z-index'], value: 0 },
  { id: 'z-index.sticky', name: 'Z-Index Sticky', category: 'foundation', group: 'z-index', type: 'number', version: '1.0.0', owner: 'design-system', tags: ['z-index'], value: 10 },
  { id: 'z-index.overlay', name: 'Z-Index Overlay', category: 'foundation', group: 'z-index', type: 'number', version: '1.0.0', owner: 'design-system', tags: ['z-index'], value: 20 },
  { id: 'z-index.modal', name: 'Z-Index Modal', category: 'foundation', group: 'z-index', type: 'number', version: '1.0.0', owner: 'design-system', tags: ['z-index'], value: 30 },
  { id: 'z-index.toast', name: 'Z-Index Toast', category: 'foundation', group: 'z-index', type: 'number', version: '1.0.0', owner: 'design-system', tags: ['z-index'], value: 40 },
] as const satisfies readonly DesignToken[];

/** Lookup helper over the foundation set. */
export const FOUNDATION_TOKENS_BY_ID: ReadonlyMap<string, DesignToken> = new Map(
  FOUNDATION_TOKENS.map((token) => [token.id, token]),
);

/** Convenience helper so callers can pass the group union properly. */
export type FoundationGroup = Extract<TokenGroup, 'color' | 'surface' | 'elevation' | 'glass' | 'shadow' | 'radius' | 'border' | 'typography' | 'font-scale' | 'line-height' | 'letter-spacing' | 'spacing' | 'icon-size' | 'density' | 'opacity' | 'blur' | 'z-index'>;

export type { TokenValue };