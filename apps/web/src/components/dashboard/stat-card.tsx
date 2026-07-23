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
      transition={{ delay }}
      className="glass-card rounded-xl p-5"
    >
      <div className="flex items-start justify-between">
        <div className={`rounded-lg ${bg} p-2.5`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </div>
      <div className="mt-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold mt-1">
          {isCurrency ? formatCurrency(value) : formatNumber(value)}
        </p>
      </div>
    </motion.div>
  );
}
