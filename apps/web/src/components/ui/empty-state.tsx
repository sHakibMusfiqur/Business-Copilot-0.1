import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-slate-400">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 mb-3">
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      {description && <p className="text-xs mt-1 text-slate-400">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
