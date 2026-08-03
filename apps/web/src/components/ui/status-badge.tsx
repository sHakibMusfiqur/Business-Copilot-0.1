import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'updated' | 'neutral';
  className?: string;
}

const variants: Record<string, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200/60 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200/60 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20',
  danger: 'bg-red-50 text-red-700 ring-red-200/60 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20',
  info: 'bg-blue-50 text-blue-700 ring-blue-200/60 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20',
  updated: 'bg-violet-50 text-violet-700 ring-violet-200/60 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-500/20',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200/60 dark:bg-white/[0.08] dark:text-slate-400 dark:ring-white/10',
};

export function StatusBadge({ label, variant = 'neutral', className }: StatusBadgeProps) {
  return (
    <span className={cn(`text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ring-inset whitespace-nowrap`, variants[variant] ?? variants.neutral, className)}>
      {label}
    </span>
  );
}
