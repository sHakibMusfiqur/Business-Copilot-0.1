import type { ReactNode, HTMLAttributes } from 'react';

export const cardClass = 'bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200';

interface DashboardCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export function DashboardCard({ children, className = '', ...props }: DashboardCardProps) {
  return (
    <div className={`${cardClass} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
