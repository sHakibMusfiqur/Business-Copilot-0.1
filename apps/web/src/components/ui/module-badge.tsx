interface ModuleBadgeProps {
  label: string;
  variant?: 'finance' | 'crm' | 'orders' | 'inventory' | 'admin' | 'default';
}

const variants: Record<string, string> = {
  finance: 'bg-rose-50 text-rose-600',
  crm: 'bg-blue-50 text-blue-600',
  orders: 'bg-amber-50 text-amber-600',
  inventory: 'bg-violet-50 text-violet-600',
  admin: 'bg-slate-50 text-slate-600',
  default: 'bg-slate-50 text-slate-600',
};

export function ModuleBadge({ label, variant = 'default' }: ModuleBadgeProps) {
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${variants[variant] ?? variants.default}`}>
      {label}
    </span>
  );
}
