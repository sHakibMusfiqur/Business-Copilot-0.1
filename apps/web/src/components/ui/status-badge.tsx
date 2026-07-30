interface StatusBadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'updated' | 'neutral';
}

const variants: Record<string, string> = {
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  info: 'bg-blue-50 text-blue-700',
  updated: 'bg-violet-50 text-violet-700',
  neutral: 'bg-slate-50 text-slate-700',
};

export function StatusBadge({ label, variant = 'neutral' }: StatusBadgeProps) {
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${variants[variant] ?? variants.neutral}`}>
      {label}
    </span>
  );
}
