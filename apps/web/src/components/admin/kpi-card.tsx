import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

import { cn, formatCurrency, formatNumber } from '@/lib/utils';
import type { KpiMetric } from './types';

const TONE_CLASSES: Record<string, string> = {
  success: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
  warning: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
  danger: 'text-red-600 dark:text-red-400 bg-red-500/10',
  info: 'text-sky-600 dark:text-sky-400 bg-sky-500/10',
  violet: 'text-violet-600 dark:text-violet-400 bg-violet-500/10',
  neutral: 'text-muted-foreground bg-muted',
};

export function KpiCard({ metric, className }: { metric: KpiMetric; className?: string }) {
  const numericValue = typeof metric.value === 'number' ? metric.value : Number(metric.value) || 0;
  const formatted =
    metric.isCurrency === false
      ? formatNumber(numericValue)
      : metric.isCurrency
        ? formatCurrency(numericValue)
        : formatNumber(numericValue);

  const display = `${formatted}${metric.suffix ?? ''}`;
  const trendUp = (metric.trend?.value ?? 0) >= 0;
  const Icon = metric.icon;

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', TONE_CLASSES[metric.tone ?? 'neutral'])}>
          {Icon && <Icon className="h-3.5 w-3.5" />}
        </div>
        {metric.trend && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium',
              trendUp ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400',
            )}
          >
            {trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(metric.trend.value)}%
          </span>
        )}
      </div>
      <p className="mt-3 text-[20px] font-semibold tracking-tight text-foreground">{display}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{metric.label}</p>
      {metric.hint && <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">{metric.hint}</p>}
    </div>
  );
}
