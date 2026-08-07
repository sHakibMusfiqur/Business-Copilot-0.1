import { DEFAULT_LAYOUT_ID, LAYOUTS, LAYOUT_BY_ID } from './layouts';
import type { LayoutDefinition, LayoutSpec } from './types';

export interface LayoutEngine {
  all: LayoutDefinition[];
  byId: (id: string) => LayoutDefinition | undefined;
  resolve: (id?: string) => LayoutDefinition;
  spec: (id?: string) => LayoutSpec;
  /** Whether the shell should render region `region` for the given layout. */
  hasRegion: (id: string, region: keyof LayoutSpec['regions']) => boolean;
}

export function createLayoutEngine(): LayoutEngine {
  return {
    all: LAYOUTS,
    byId: (id) => (id ? LAYOUT_BY_ID[id] : undefined),
    resolve: (id) => (id ? LAYOUT_BY_ID[id] ?? LAYOUTS[0] : LAYOUTS[0]),
    spec: (id) => (id ? (LAYOUT_BY_ID[id] ?? LAYOUTS[0]).spec : LAYOUTS[0].spec),
    hasRegion: (id, region) => (id ? (LAYOUT_BY_ID[id] ?? LAYOUTS[0]) : LAYOUTS[0]).spec.regions[region],
  };
}

export const layoutEngine: LayoutEngine = createLayoutEngine();

export { DEFAULT_LAYOUT_ID };
