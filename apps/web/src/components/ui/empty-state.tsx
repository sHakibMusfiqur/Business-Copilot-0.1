import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200/70 bg-slate-50 text-slate-400 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-500">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-[15px] font-semibold text-slate-700 dark:text-slate-200">{title}</p>
      {description && <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-slate-400 dark:text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
