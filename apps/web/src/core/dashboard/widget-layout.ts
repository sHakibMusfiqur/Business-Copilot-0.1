import type { WidgetSpan, WidgetZone } from '@/core/workspace/types';

import type { DashboardWidget } from './widget-types';

/** Canonical zone display order (hero → bottom). */
export const ZONE_ORDER: readonly WidgetZone[] = [
  'hero',
  'kpis',
  'charts',
  'insights',
  'side',
  'bottom',
];

/** Responsive class recipe per span size (12-column grid). */
const SPAN_CLASSES: Record<WidgetSpan, { base: string; sm: string; xl: string }> = {
  3: { base: 'col-span-12', sm: 'sm:col-span-6', xl: 'xl:col-span-3' },
  4: { base: 'col-span-12', sm: 'sm:col-span-6', xl: 'xl:col-span-4' },
  5: { base: 'col-span-12', sm: 'sm:col-span-6', xl: 'xl:col-span-5' },
  6: { base: 'col-span-12', sm: 'sm:col-span-6', xl: 'xl:col-span-6' },
  7: { base: 'col-span-12', sm: 'sm:col-span-6', xl: 'xl:col-span-7' },
  8: { base: 'col-span-12', sm: 'sm:col-span-6', xl: 'xl:col-span-8' },
  12: { base: 'col-span-12', sm: 'sm:col-span-12', xl: 'xl:col-span-12' },
};

/** Resolve the responsive class tokens for a span. */
export function spanTokens(span: WidgetSpan): string {
  const recipe = SPAN_CLASSES[span];
  return `${recipe.base} ${recipe.sm} ${recipe.xl}`;
}

/** Whether a zone should render (has widgets). */
export function zoneHasWidgets(widgets: readonly DashboardWidget[], zone: WidgetZone): boolean {
  return widgets.some((widget) => widget.zone === zone);
}

/** Zone order index for stable layout composition. */
export function zoneIndex(zone: WidgetZone): number {
  const index = ZONE_ORDER.indexOf(zone);
  return index === -1 ? ZONE_ORDER.length : index;
}

export type { WidgetSpan, WidgetZone };