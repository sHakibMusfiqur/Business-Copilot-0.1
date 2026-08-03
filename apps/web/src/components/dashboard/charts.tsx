'use client';

import { useId } from 'react';

interface ChartSeries {
  data: number[];
  color: string;
  label?: string;
}

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cx = (prev.x + curr.x) / 2;
    d += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

function normalize(data: number[], width: number, height: number, pad = 4): { x: number; y: number }[] {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  return data.map((v, i) => ({
    x: pad + (i / Math.max(data.length - 1, 1)) * (width - pad * 2),
    y: pad + (1 - (v - min) / range) * (height - pad * 2),
  }));
}

export function Sparkline({ data, color, className }: { data: number[]; color: string; className?: string }) {
  const id = useId();
  const width = 120;
  const height = 36;
  const points = normalize(data, width, height);
  const line = smoothPath(points);
  const area = `${line} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="2.5" fill={color} />
    </svg>
  );
}

export function TrendChart({ series, height = 180 }: { series: ChartSeries[]; height?: number }) {
  const id = useId();
  const width = 560;
  const points = series[0] ? normalize(series[0].data, width, height) : [];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={series[0]?.color ?? '#2563EB'} stopOpacity="0.28" />
            <stop offset="100%" stopColor={series[0]?.color ?? '#2563EB'} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="0"
            x2={width}
            y1={height * f}
            y2={height * f}
            stroke="rgba(100,116,139,0.18)"
            strokeDasharray="4 6"
          />
        ))}

        {series.map((s, si) => {
          const pts = normalize(s.data, width, height);
          const line = smoothPath(pts);
          if (si === 0) {
            const area = `${line} L ${pts[pts.length - 1].x} ${height} L ${pts[0].x} ${height} Z`;
            return (
              <g key={si}>
                <path d={area} fill={`url(#area-${id})`} />
                <path d={line} fill="none" stroke={s.color} strokeWidth="2.25" strokeLinecap="round" />
              </g>
            );
          }
          return <path key={si} d={line} fill="none" stroke={s.color} strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" />;
        })}

        {/* End dot */}
        {points.length > 0 && (
          <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="4" fill={series[0]?.color ?? 'hsl(var(--primary))'} stroke="hsl(var(--card))" strokeWidth="2" />
        )}
      </svg>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {series.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{s.label ?? 'Series'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
