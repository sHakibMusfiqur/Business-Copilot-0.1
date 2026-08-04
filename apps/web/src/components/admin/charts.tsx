'use client';

import { useId } from 'react';

import { cn, formatNumber } from '@/lib/utils';
import type { ChartData } from './types';

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--brand-accent))',
  'hsl(var(--brand-secondary))',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#06B6D4',
  '#EC4899',
];

function points(data: number[], width: number, height: number, pad = 8): { x: number; y: number }[] {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  return data.map((v, i) => ({
    x: pad + (i / Math.max(data.length - 1, 1)) * (width - pad * 2),
    y: pad + (1 - (v - min) / range) * (height - pad * 2),
  }));
}

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cx = (prev.x + curr.x) / 2;
    d += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

interface ChartScaffoldProps {
  height?: number;
  children: React.ReactNode;
  className?: string;
}

function ChartScaffold({ height = 220, children, className }: ChartScaffoldProps) {
  return (
    <div className={cn('relative', className)} style={{ height }}>
      {children}
    </div>
  );
}

/** Line / area chart. Accepts either an array of points or a single series array. */
export function AreaChart({
  data,
  labels,
  color = 'hsl(var(--primary))',
  height = 220,
  className,
  showLegend = true,
}: {
  data: number[];
  labels?: string[];
  color?: string;
  height?: number;
  className?: string;
  showLegend?: boolean;
}) {
  const id = useId();
  const W = 640;
  const H = height;
  const pad = 12;
  const pts = points(data, W, H, pad);
  const line = smoothPath(pts);
  const area = `${line} L ${pts[pts.length - 1]?.x ?? pad} ${H - pad} L ${pts[0]?.x ?? pad} ${H - pad} Z`;

  return (
    <div className={className}>
      <ChartScaffold height={height}>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={pad} x2={W - pad} y1={H * f} y2={H * f} stroke="hsl(var(--border))" strokeDasharray="3 5" />
          ))}
          {data.length > 0 && (
            <>
              <path d={area} fill={`url(#area-${id})`} />
              <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
              <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3" fill={color} stroke="hsl(var(--card))" strokeWidth="1.5" />
            </>
          )}
        </svg>
      </ChartScaffold>
      {showLegend && labels && labels.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="h-2 w-2 rounded-full" style={{ background: color }} />
          <span className="text-[11px] text-muted-foreground">
            {labels[labels.length - 1] ?? ''} · {formatNumber(data[data.length - 1] ?? 0)}
          </span>
        </div>
      )}
    </div>
  );
}

/** Vertical bar chart for grouped/sequential data. */
export function BarChart({
  data,
  height = 220,
  className,
  showValues = true,
}: {
  data: ChartData[];
  height?: number;
  className?: string;
  showValues?: boolean;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className={className}>
      <ChartScaffold height={height}>
        <div className="flex h-full items-end gap-2">
          {data.map((d) => (
            <div key={d.label} className="flex h-full min-w-0 flex-1 flex-col justify-end">
              {showValues && (
                <span className="mb-1 truncate text-center text-[10px] text-muted-foreground">
                  {formatNumber(d.value)}
                </span>
              )}
              <div
                className="w-full rounded-t-[3px] transition-all"
                style={{
                  height: `${Math.max((d.value / max) * 82, 2)}%`,
                  background: d.color ?? 'hsl(var(--primary))',
                }}
                title={`${d.label}: ${formatNumber(d.value)}`}
              />
            </div>
          ))}
        </div>
      </ChartScaffold>
      <div className="mt-2 flex gap-2">
        {data.map((d) => (
          <span key={d.label} className="min-w-0 flex-1 truncate text-center text-[11px] text-muted-foreground">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Donut chart for distribution data. */
export function DonutChart({
  data,
  centerLabel,
  centerValue,
  height = 200,
  className,
}: {
  data: ChartData[];
  centerLabel?: string;
  centerValue?: string;
  height?: number;
  className?: string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  const R = 60;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative" style={{ height, width: height }}>
        <svg viewBox={`0 0 160 160`} className="h-full w-full -rotate-90">
          <circle cx="80" cy="80" r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="14" />
          {data.map((d, i) => {
            const frac = d.value / total;
            const dash = frac * C;
            const el = (
              <circle
                key={d.label}
                cx="80"
                cy="80"
                r={R}
                fill="none"
                stroke={d.color ?? CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth="14"
                strokeDasharray={`${Math.max(dash - 1.5, 0.5)} ${C}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += dash;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerValue && <span className="text-lg font-semibold text-foreground">{centerValue}</span>}
          {centerLabel && <span className="text-[11px] text-muted-foreground">{centerLabel}</span>}
        </div>
      </div>
      <div className="mt-3 grid w-full grid-cols-2 gap-x-4 gap-y-1.5">
        {data.map((d, i) => (
          <div key={d.label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color ?? CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{d.label}</span>
            <span className="text-[11px] font-medium text-foreground">{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
