import { cn } from '@/lib/utils';

interface ModuleBadgeProps {
  label: string;
  variant?: 'finance' | 'crm' | 'orders' | 'inventory' | 'admin' | 'default';
  className?: string;
}

const variants: Record<string, string> = {
  finance: 'bg-rose-50 text-rose-700 ring-rose-200/60 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20',
  crm: 'bg-blue-50 text-blue-700 ring-blue-200/60 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20',
  orders: 'bg-amber-50 text-amber-700 ring-amber-200/60 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20',
  inventory: 'bg-violet-50 text-violet-700 ring-violet-200/60 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-500/20',
  admin: 'bg-slate-100 text-slate-600 ring-slate-200/60 dark:bg-white/[0.08] dark:text-slate-400 dark:ring-white/10',
  default: 'bg-slate-100 text-slate-600 ring-slate-200/60 dark:bg-white/[0.08] dark:text-slate-400 dark:ring-white/10',
};

export function ModuleBadge({ label, variant = 'default', className }: ModuleBadgeProps) {
  return (
    <span className={cn(`text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ring-inset whitespace-nowrap`, variants[variant] ?? variants.default, className)}>
      {label}
    </span>
  );
}
