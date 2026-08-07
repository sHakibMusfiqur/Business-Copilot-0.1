import { resolveWorkspace } from '@/core/manifest/manifest-engine';
import type { ResolvedWorkspace, WorkspaceContextInput } from './types';
import { emptyStatistics, resolveWidgetData } from './widget-data';
import type { DashboardOverview, DashboardStatistics } from '@/components/dashboard/types';

export type {
  ResolvedWorkspace,
  WorkspaceContextInput,
} from './types';

export const workspaceEngine = {
  resolve: (input: WorkspaceContextInput): ResolvedWorkspace => resolveWorkspace(input),
  widgetData: (
    source: string | undefined,
    overview: DashboardOverview | null,
    accent: string,
  ) => resolveWidgetData(source, overview, accent),
  emptyStatistics: (): DashboardStatistics => emptyStatistics(),
};

export { resolveWorkspace, resolveWidgetData, emptyStatistics };
export type { WidgetData, WidgetSource, StatusTone, WidgetMetric, WidgetSeries, WidgetDistribution, WidgetListRow } from './widget-data';
