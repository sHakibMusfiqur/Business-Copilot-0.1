'use client';

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  CircleCheck,
  Clock,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useMemo } from 'react';

import { ActivityTimeline } from '@/components/dashboard/activity-timeline';
import { TrendChart } from '@/components/dashboard/charts';
import type { DashboardOverview } from '@/components/dashboard/types';
import { TrendBadge } from '@/components/ui/trend-badge';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { WidgetDefinition, WorkspaceManifest } from '@/core/workspace/types';
import {
  STATUS_TONES,
  statusClasses,
} from '@/core/theme/widget-styles';
import type { WidgetData } from '@/core/workspace/widget-data';

export interface WorkspaceWidgetProps {
  widget: WidgetDefinition;
  data: WidgetData;
  overview: DashboardOverview | null;
  manifest?: WorkspaceManifest;
  onCommand?: (command: string) => void;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={`panel-card overflow-hidden p-4 ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function MetricWidget({ data }: WorkspaceWidgetProps) {
  const m = data.metric;
  const isUnavailable = data.available === false || (m && !m.available);

  if (isUnavailable) {
    return (
      <Card>
        <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">{m?.label ?? data.title}</p>
        <div className="mt-2 flex h-[40px] items-center">
          <span className="text-[13px] text-muted-foreground italic">Data not available</span>
        </div>
        <div className="mt-3 border-t border-border/50 pt-2">
          <span className="text-[11px] text-muted-foreground">Connect module to view</span>
        </div>
      </Card>
    );
  }

  const value = m ? (m.currency ? formatCurrency(m.value) : formatNumber(Math.round(m.value))) : '—';
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">{m?.label ?? data.title}</p>
        {m && m.trend !== null && <TrendBadge value={`${m.trend >= 0 ? '+' : ''}${m.trend}%`} positive={m.trendPositive ?? true} />}
      </div>
      <p className="mt-2 text-[28px] font-bold leading-8 tracking-tight tabular-nums sm:text-[32px]">{value}</p>
      <div className="mt-3 flex items-end justify-between gap-2">
        {m && m.trend !== null ? (
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${m.trendPositive ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            vs last month
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">No trend data</span>
        )}
      </div>
    </Card>
  );
}

export function TrendWidget({ data }: WorkspaceWidgetProps) {
  const s = data.series;
  const hasRealData = s && s.data.some((d) => d !== 0);

  if (!hasRealData) {
    return (
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">{data.title}</p>
            <p className="mt-1 text-[22px] font-bold tracking-tight tabular-nums text-muted-foreground">—</p>
          </div>
        </div>
        <div className="mt-3 flex h-[120px] items-center justify-center">
          <span className="text-[13px] text-muted-foreground italic">No trend data available</span>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">{data.title}</p>
          <p className="mt-1 text-[22px] font-bold tracking-tight tabular-nums">{s?.value ?? '—'}</p>
        </div>
      </div>
      <div className="mt-3">
        <TrendChart height={120} series={[{ data: s?.data ?? [], color: data.accent, label: s?.label }]} />
      </div>
    </Card>
  );
}

export function ForecastWidget({ data }: WorkspaceWidgetProps) {
  const s = data.series;
  const past = s?.data ?? [];
  const hasRealData = past.some((d) => d !== 0);

  if (!hasRealData) {
    return (
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">{data.title}</p>
            <p className="mt-1 text-[20px] font-bold tracking-tight tabular-nums text-muted-foreground">—</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            Forecast
          </span>
        </div>
        <div className="mt-3 flex h-[120px] items-center justify-center">
          <span className="text-[13px] text-muted-foreground italic">No historical data for forecast</span>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">{data.title}</p>
          <p className="mt-1 text-[20px] font-bold tracking-tight tabular-nums">{s?.value ?? '—'}</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] font-semibold text-primary">
          Forecast
        </span>
      </div>
      <div className="mt-3">
        <TrendChart
          height={120}
          series={[
            { data: past, color: data.accent, label: 'Actual' },
          ]}
        />
      </div>
    </Card>
  );
}

export function DonutWidget({ data }: WorkspaceWidgetProps) {
  const parts = data.distribution ?? [];
  const total = parts.reduce((a, b) => a + b.value, 0) || 1;
  const R = 34;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <Card>
      <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">{data.title}</p>
      <div className="mt-3 flex items-center gap-5">
        <div className="relative h-[88px] w-[88px] shrink-0">
          <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90">
            <circle cx="44" cy="44" r={R} fill="none" stroke="rgba(100,116,139,0.15)" strokeWidth="9" />
            {parts.map((p, i) => {
              const len = (p.value / total) * C;
              const seg = (
                <circle
                  key={i}
                  cx="44"
                  cy="44"
                  r={R}
                  fill="none"
                  stroke={p.color}
                  strokeWidth="9"
                  strokeDasharray={`${len} ${C - len}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
              offset += len;
              return seg;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[15px] font-bold tabular-nums">{formatNumber(total)}</span>
            <span className="text-[9px] font-medium uppercase tracking-wide text-slate-400">Total</span>
          </div>
        </div>
        <ul className="min-w-0 flex-1 space-y-1.5">
          {parts.map((p, i) => (
            <li key={i} className="flex items-center gap-2 text-[12px]">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
              <span className="truncate text-slate-500 dark:text-slate-400">{p.label}</span>
              <span className="ml-auto font-semibold tabular-nums">{formatNumber(p.value)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

export function ListWidget({ data }: WorkspaceWidgetProps) {
  const rows = data.rows ?? [];
  return (
    <Card>
      <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">{data.title}</p>
      <ul className="mt-2 space-y-0.5">
        {rows.slice(0, 5).map((r) => (
          <li key={r.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03]">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_TONES[r.tone ?? 'neutral']}`} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium leading-snug text-slate-700 dark:text-slate-200">{r.title}</p>
              <p className="truncate text-[11px] leading-snug text-muted-foreground">{r.subtitle}</p>
            </div>
            <span className="shrink-0 text-[11px] font-medium text-slate-400 dark:text-slate-500">{r.meta}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ActivityWidget({ overview }: WorkspaceWidgetProps) {
  return <ActivityTimeline activities={overview?.recentActivities ?? []} />;
}

export function AiInsightsWidget({ data }: WorkspaceWidgetProps) {
  const insights = data.ai ?? [];
  return (
    <Card className="relative">
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/[0.06] blur-2xl" />
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] text-white">
            <Sparkles className="h-3 w-3" />
          </div>
          <p className="text-[13px] font-semibold tracking-tight">AI Insights</p>
        </div>
        <ul className="mt-3 space-y-2.5">
          {insights.slice(0, 4).map((insight, i) => (
            <li key={i} className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-card/60 px-3 py-2.5">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">{insight}</p>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

export function HealthScoreWidget({ data }: WorkspaceWidgetProps) {
  const health = data.health;
  const score = health?.score ?? 0;
  const label = health?.label ?? '—';
  const R = 34;
  const C = 2 * Math.PI * R;

  if (!health) {
    return (
      <Card>
        <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">{data.title}</p>
        <div className="mt-3 flex h-[92px] items-center justify-center">
          <span className="text-[13px] text-muted-foreground italic">No data to compute health score</span>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">{data.title}</p>
      <div className="mt-3 flex items-center gap-5">
        <div className="relative h-[92px] w-[92px] shrink-0">
          <svg viewBox="0 0 92 92" className="h-full w-full -rotate-90">
            <circle cx="46" cy="46" r={R} fill="none" stroke="rgba(100,116,139,0.15)" strokeWidth="8" />
            <circle
              cx="46"
              cy="46"
              r={R}
              fill="none"
              stroke={score >= 65 ? '#22C55E' : score >= 45 ? '#F59E0B' : '#EF4444'}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${(score / 100) * C} ${C}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[20px] font-bold tabular-nums">{score}</span>
          </div>
        </div>
        <div>
          <p className="text-[15px] font-semibold tracking-tight">{label}</p>
          <p className="mt-1 max-w-[140px] text-[12px] leading-relaxed text-muted-foreground">
            Derived from real inventory, leave and financial data.
          </p>
        </div>
      </div>
    </Card>
  );
}

export function ApprovalsWidget({ data, onCommand }: WorkspaceWidgetProps) {
  const rows = data.approvals ?? [];
  return (
    <Card>
      <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">{data.title}</p>
      <ul className="mt-2 space-y-2">
        {rows.slice(0, 4).map((r) => (
          <li key={r.id} className="rounded-xl border border-border/70 bg-card/70 px-3 py-2.5">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-slate-700 dark:text-slate-200">{r.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">{r.subtitle}</p>
              </div>
              <button
                onClick={() => onCommand?.('approvals.list')}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                <Check className="h-3 w-3" /> Approve
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function CalendarWidget({ data }: WorkspaceWidgetProps) {
  const items = data.calendar ?? [];
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const itemDays = new Set(items.map((i) => i.day));
  const today = now.getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">{data.title}</p>
        <span className="text-[11px] font-semibold capitalize text-slate-500 dark:text-slate-400">
          {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i} className="text-[10px] font-semibold uppercase text-slate-400 dark:text-slate-500">{d}</span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={i} />;
          const hasItems = itemDays.has(day);
          const isToday = day === today;
          return (
            <span
              key={i}
              className={`relative mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-medium ${
                isToday
                  ? 'bg-primary text-primary-foreground'
                  : hasItems
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {day}
              {hasItems && !isToday && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary" />}
            </span>
          );
        })}
      </div>
      {items.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-border/70 pt-3">
          {items.map((i, idx) => (
            <li key={idx} className="flex items-center gap-2 text-[12px]">
              <Clock className="h-3 w-3 text-slate-400" />
              <span className="font-semibold tabular-nums text-slate-600 dark:text-slate-300">{i.day}</span>
              <span className="text-muted-foreground">{i.items[0]}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function QuickActionsWidget({ manifest, onCommand }: WorkspaceWidgetProps) {
  const actions = manifest?.quickActions ?? [];
  if (actions.length === 0) return null;
  return (
    <Card>
      <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">Quick Actions</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.slice(0, 6).map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.id}
              onClick={() => onCommand?.(a.command ?? a.id)}
              className="inline-flex items-center gap-2 rounded-[10px] border border-border bg-card px-3 py-2 text-[12px] font-medium text-slate-600 transition-colors hover:border-primary/30 hover:text-primary dark:text-slate-300 dark:bg-white/[0.03]"
            >
              <Icon className="h-3.5 w-3.5" />
              {a.label}
              {a.shortcut && (
                <kbd className="ml-0.5 rounded border border-border bg-slate-50 px-1 text-[9px] font-semibold text-slate-400 dark:bg-white/[0.06]">
                  {a.shortcut}
                </kbd>
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

export function AlertsBanner({ overview }: { overview: DashboardOverview | null }) {
  const stats = overview?.statistics;
  const alerts: { icon: LucideIcon; text: string; tone: 'warning' | 'danger' }[] = [];
  if (stats && stats.lowStockProducts > 0) {
    alerts.push({
      icon: AlertTriangle,
      text: `${stats.lowStockProducts} product${stats.lowStockProducts > 1 ? 's' : ''} below reorder point`,
      tone: 'warning',
    });
  }
  if (stats && stats.pendingLeaves > 0) {
    alerts.push({ icon: CircleCheck, text: `${stats.pendingLeaves} leave request${stats.pendingLeaves > 1 ? 's' : ''} awaiting approval`, tone: 'warning' });
  }
  if (alerts.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap items-center gap-2"
    >
      {alerts.map((a, i) => (
        <span
          key={i}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
            a.tone === 'danger'
              ? 'border-red-500/20 bg-red-500/5 text-red-500 dark:text-red-400'
              : 'border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400'
          }`}
        >
          <a.icon className="h-3 w-3" />
          {a.text}
        </span>
      ))}
    </motion.div>
  );
}

export function useStatusClasses(tone: keyof typeof statusClasses): string {
  return useMemo(() => statusClasses[tone] ?? statusClasses.neutral, [tone]);
}
