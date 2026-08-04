import { cn, formatDateTime } from '@/lib/utils';
import type { ActivityItem } from './types';

const TONE_CLASSES: Record<string, string> = {
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  danger: 'bg-red-500/10 text-red-600 dark:text-red-400',
  info: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  neutral: 'bg-muted text-muted-foreground',
};

export function ActivityList({
  items,
  className,
  limit,
}: {
  items: ActivityItem[];
  className?: string;
  limit?: number;
}) {
  const visible = limit ? items.slice(0, limit) : items;
  if (visible.length === 0) return null;

  return (
    <ul className={cn('divide-y divide-border', className)}>
      {visible.map((item) => (
        <li key={item.id} className="flex items-start gap-3 py-2.5">
          {item.icon && (
            <div className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md', TONE_CLASSES[item.tone ?? 'neutral'])}>
              <item.icon className="h-3.5 w-3.5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-foreground">{item.title}</p>
            {item.description && <p className="truncate text-[12px] text-muted-foreground">{item.description}</p>}
          </div>
          {item.timestamp && (
            <span className="shrink-0 text-[11px] text-muted-foreground">{formatDateTime(item.timestamp)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
