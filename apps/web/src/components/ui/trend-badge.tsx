import { TrendingUp, TrendingDown } from 'lucide-react';

interface TrendBadgeProps {
  value: string;
  positive: boolean;
}

export function TrendBadge({ value, positive }: TrendBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 border ${
      positive
        ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
        : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
    }`}>
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {value}
    </span>
  );
}
