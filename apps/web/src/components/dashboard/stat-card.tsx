import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

import { formatCurrency, formatNumber } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
  bg: string;
  isCurrency?: boolean;
  delay?: number;
}

export function StatCard({ label, value, icon: Icon, color, bg, isCurrency, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 p-5 group cursor-default"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg} ${color} group-hover:scale-105 transition-transform duration-200`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="text-sm font-medium text-slate-500 mb-0.5">{label}</p>
      <p className="text-2xl font-bold tracking-tight text-slate-900">
        {isCurrency ? formatCurrency(value) : formatNumber(value)}
      </p>
    </motion.div>
  );
}
