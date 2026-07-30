import { TrendingUp, TrendingDown } from 'lucide-react';

interface TrendBadgeProps {
  value: string;
  positive: boolean;
}

export function TrendBadge({ value, positive }: TrendBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 ${
      positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
    }`}>
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {value}
    </span>
  );
}
