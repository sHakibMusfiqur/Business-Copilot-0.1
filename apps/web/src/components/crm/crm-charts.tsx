'use client';

import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Area,
  Line,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';

import { formatCurrency } from '@/lib/utils';

import type { CrmFunnelStage, CrmRevenueTrend } from '@/lib/api';

function TrendTooltip({ active, payload, label }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null;
  const revenue = payload.find((p) => p.dataKey === 'revenue')?.value;
  const deals = payload.find((p) => p.dataKey === 'deals')?.value;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
      <p className="mb-1 text-xs font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">
        Revenue: <span className="font-medium text-foreground">{formatCurrency(Number(revenue ?? 0))}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        Deals won: <span className="font-medium text-foreground">{Number(deals ?? 0)}</span>
      </p>
    </div>
  );
}

/** Won-revenue trend over the selected range, rendered with recharts. */
export function RevenueTrendChart({ trend }: { trend: CrmRevenueTrend }) {
  const data = trend.labels.map((label, index) => ({
    label,
    revenue: trend.revenue[index] ?? 0,
    deals: trend.deals[index] ?? 0,
  }));
  const hasData = data.some((d) => d.revenue !== 0 || d.deals !== 0);

  if (!hasData) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">No won deals in this period yet.</p>
      </div>
    );
  }

  return (
    <div role="img" aria-label="Won revenue trend chart" className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="label" className="text-xs" tick={{ fontSize: 12 }} />
          <YAxis
            yAxisId="left"
            className="text-xs"
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) => formatCurrency(v)}
          />
          <YAxis yAxisId="right" orientation="right" className="text-xs" tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip content={<TrendTooltip />} />
          <Legend />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke="#2563EB"
            fill="#2563EB"
            fillOpacity={0.18}
            strokeWidth={2}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="deals"
            name="Deals won"
            stroke="#22c55e"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Stage funnel as accessible, div-based bars: every value is also rendered as
 * visible text, so the bars are decorative (aria-hidden).
 */
export function FunnelBars({ stages }: { stages: CrmFunnelStage[] }) {
  if (stages.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground">No pipeline stages to display.</p>
      </div>
    );
  }

  const entryCount = Math.max(stages[0]?.dealCount ?? 0, 1);

  return (
    <div role="group" aria-label="Deal funnel by stage" className="space-y-4">
      {stages.map((stage, index) => {
        const width = Math.max(2, Math.round((stage.dealCount / entryCount) * 100));
        const isFirst = index === 0;

        return (
          <div key={stage.stageId} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium truncate">{stage.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {stage.dealCount} {stage.dealCount === 1 ? 'deal' : 'deals'} · {formatCurrency(stage.value)}
                {!isFirst && ` · ${stage.conversionFromPrevious}%`}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div
                className="h-full rounded-full bg-primary/75 transition-all"
                style={{ width: `${width}%` }}
              />
            </div>
            {!isFirst && (
              <p className="text-xs text-muted-foreground">
                {stage.conversionFromPrevious}% converted from {stages[index - 1]?.name ?? 'previous stage'}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
