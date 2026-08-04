import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface PanelCardProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}

export function PanelCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  padded = true,
}: PanelCardProps) {
  return (
    <section
      className={cn(
        'rounded-lg border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            {Icon && (
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
              </div>
            )}
            <div className="min-w-0">
              {title && <h3 className="truncate text-[13px] font-semibold text-foreground">{title}</h3>}
              {description && <p className="truncate text-xs text-muted-foreground">{description}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn(padded && 'p-4')}>{children}</div>
    </section>
  );
}
