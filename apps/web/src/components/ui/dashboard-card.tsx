import type { ReactNode, HTMLAttributes } from 'react';

export const cardClass = 'panel-card';

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
