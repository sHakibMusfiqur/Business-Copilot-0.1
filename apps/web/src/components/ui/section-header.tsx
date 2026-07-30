import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  description?: string;
  count?: number;
  action?: ReactNode;
}

export function SectionHeader({ title, description, count, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      <div className="flex items-center gap-2">
        {count !== undefined && (
          <span className="text-[11px] font-medium text-slate-400 bg-slate-50 rounded-full px-2 py-0.5">
            {count} items
          </span>
        )}
        {action}
      </div>
    </div>
  );
}
