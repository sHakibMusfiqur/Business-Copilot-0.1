import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  description?: string;
  count?: number;
  action?: ReactNode;
}

export function SectionHeader({ title, description, count, action }: SectionHeaderProps) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-foreground">{title}</h3>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {count !== undefined && (
          <span className="text-[11px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">
            {count} items
          </span>
        )}
        {action}
      </div>
    </div>
  );
}
