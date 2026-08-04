import { cn } from '@/lib/utils';

interface MetricRow {
  label: string;
  value: React.ReactNode;
  hint?: string;
}

export function MetricList({
  items,
  className,
  dense,
}: {
  items: MetricRow[];
  className?: string;
  dense?: boolean;
}) {
  return (
    <dl className={cn('divide-y divide-border', className)}>
      {items.map((item) => (
        <div key={item.label} className={cn('flex items-center justify-between gap-3', dense ? 'py-1.5' : 'py-2.5')}>
          <dt className="text-[13px] text-muted-foreground">
            {item.label}
            {item.hint && <span className="block text-[11px] text-muted-foreground/70">{item.hint}</span>}
          </dt>
          <dd className="text-[13px] font-medium text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
