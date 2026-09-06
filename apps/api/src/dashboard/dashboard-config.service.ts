import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import {
  type IndustryDashboardConfig,
  type WidgetConfig,
  type OrgDashboardOverride,
  type IndustryKey,
  getIndustryConfig,
  VALID_INDUSTRY_KEYS,
  VALID_WIDGET_SOURCES,
} from './industry-configs';

/** Resolved dashboard configuration sent to the frontend. */
export interface ResolvedDashboardConfig {
  industry: IndustryKey;
  kpis: WidgetConfig[];
  charts: WidgetConfig[];
  secondary: WidgetConfig[];
  alerts: WidgetConfig[];
  insights: WidgetConfig[];
  bottom: WidgetConfig[];
  allWidgets: WidgetConfig[];
}

/** User-facing dashboard config override stored in OrganizationSettings.settings.dashboard. */
export interface DashboardSettingsPayload {
  enabledWidgets?: string[];
  hiddenWidgets?: string[];
  widgetOrder?: string[];
  kpis?: string[];
  charts?: string[];
  secondary?: string[];
  alerts?: string[];
}

@Injectable()
export class DashboardConfigService {
  private readonly logger = new Logger(DashboardConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  
  async resolveConfig(
    orgId: string,
    permissions: string[],
  ): Promise<ResolvedDashboardConfig> {
    const { industry, orgOverride } = await this.getOrgSettings(orgId);
    const industryConfig = getIndustryConfig(industry);

    const hasPermission = (...required: string[]): boolean =>
      required.some((p) => permissions.includes(p));

    const filterByPermission = (widgets: WidgetConfig[]): WidgetConfig[] =>
      widgets.filter((w) => {
        if (!w.permission || w.permission.length === 0) return true;
        return hasPermission(...w.permission);
      });

    const filterBySource = (widgets: WidgetConfig[]): WidgetConfig[] =>
      widgets.filter((w) => VALID_WIDGET_SOURCES.has(w.source));

    const filterByHidden = (widgets: WidgetConfig[]): WidgetConfig[] =>
      widgets.filter((w) => !(orgOverride?.hiddenWidgets ?? []).includes(w.id));

    const applyOrder = (widgets: WidgetConfig[]): WidgetConfig[] => {
      if (!orgOverride?.widgetOrder || orgOverride.widgetOrder.length === 0) {
        return widgets;
      }
      const orderMap = new Map(
        orgOverride.widgetOrder.map((id, index) => [id, index]),
      );
      return [...widgets].sort((a, b) => {
        const aIdx = orderMap.get(a.id);
        const bIdx = orderMap.get(b.id);
        if (aIdx !== undefined && bIdx !== undefined) return aIdx - bIdx;
        if (aIdx !== undefined) return -1;
        if (bIdx !== undefined) return 1;
        return 0;
      });
    };

    const processZone = (widgets: WidgetConfig[]): WidgetConfig[] =>
      applyOrder(filterByHidden(filterByPermission(filterBySource(widgets))));

    const kpis = processZone(
      orgOverride?.kpis
        ? this.remapWidgets(industryConfig.kpis, orgOverride.kpis)
        : industryConfig.kpis,
    );

    const charts = processZone(
      orgOverride?.charts
        ? this.remapWidgets(industryConfig.charts, orgOverride.charts)
        : industryConfig.charts,
    );

    const secondary = processZone(
      orgOverride?.secondary
        ? this.remapWidgets(industryConfig.secondary, orgOverride.secondary)
        : industryConfig.secondary,
    );

    const alerts = processZone(
      orgOverride?.alerts
        ? this.remapWidgets(industryConfig.alerts, orgOverride.alerts)
        : industryConfig.alerts,
    );

    const insights = processZone(industryConfig.insights);
    const bottom = processZone(industryConfig.bottom);

    // Add any enabledWidgets that aren't already in the config
    const allWidgetIds = new Set(
      [...kpis, ...charts, ...secondary, ...alerts, ...insights, ...bottom].map(
        (w) => w.id,
      ),
    );
    const extraWidgets: WidgetConfig[] = [];
    if (orgOverride?.enabledWidgets) {
      for (const widgetId of orgOverride.enabledWidgets) {
        if (!allWidgetIds.has(widgetId)) {
          const widget = this.findWidgetInAllConfigs(widgetId, industryConfig);
          if (widget && VALID_WIDGET_SOURCES.has(widget.source)) {
            const permitted =
              !widget.permission ||
              widget.permission.length === 0 ||
              hasPermission(...widget.permission);
            if (permitted) {
              extraWidgets.push({ ...widget, supported: true });
              allWidgetIds.add(widgetId);
            }
          }
        }
      }
    }

    const allWidgets = [
      ...kpis,
      ...charts,
      ...secondary,
      ...alerts,
      ...insights,
      ...bottom,
      ...extraWidgets,
    ];

    return {
      industry: (industry as IndustryKey) ?? 'general',
      kpis,
      charts,
      secondary,
      alerts,
      insights,
      bottom,
      allWidgets,
    };
  }

  /** Single query to read both industry and dashboard override from OrganizationSettings. */
  private async getOrgSettings(
    orgId: string,
  ): Promise<{ industry: string | null; orgOverride: OrgDashboardOverride | null }> {
    try {
      const settings = await this.prisma.organizationSettings.findUnique({
        where: { organizationId: orgId },
        select: { settings: true },
      });

      if (!settings?.settings || typeof settings.settings !== 'object') {
        return { industry: null, orgOverride: null };
      }

      const raw = settings.settings as Record<string, unknown>;
      const industryValue = typeof raw.industry === 'string' && VALID_INDUSTRY_KEYS.has(raw.industry)
        ? raw.industry
        : null;
      const dashboardValue = raw.dashboard && typeof raw.dashboard === 'object'
        ? (raw.dashboard as OrgDashboardOverride)
        : null;

      return { industry: industryValue, orgOverride: dashboardValue };
    } catch (error) {
      this.logger.error(
        `Failed to read settings for org ${orgId}: ${(error as Error).message}`,
      );
      return { industry: null, orgOverride: null };
    }
  }

  /** Remap a widget list to only include IDs from the override, preserving industry config data. */
  private remapWidgets(
    industryWidgets: WidgetConfig[],
    overrideIds: string[],
  ): WidgetConfig[] {
    if (!overrideIds || overrideIds.length === 0) return industryWidgets;
    const widgetMap = new Map(industryWidgets.map((w) => [w.id, w]));
    return overrideIds
      .map((id) => widgetMap.get(id))
      .filter((w): w is WidgetConfig => w !== undefined);
  }

  /** Search all industry configs for a widget by ID. */
  private findWidgetInAllConfigs(
    widgetId: string,
    currentConfig: IndustryDashboardConfig,
  ): WidgetConfig | null {
    const allWidgets = [
      ...currentConfig.kpis,
      ...currentConfig.charts,
      ...currentConfig.secondary,
      ...currentConfig.alerts,
      ...currentConfig.insights,
      ...currentConfig.bottom,
    ];
    return allWidgets.find((w) => w.id === widgetId) ?? null;
  }
}
