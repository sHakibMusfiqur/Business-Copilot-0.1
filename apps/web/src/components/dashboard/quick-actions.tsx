import { motion } from 'framer-motion';
import {
  Users,
  Package,
  Receipt,
  ShoppingBag,
  UserPlus,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

import type { QuickAction as QuickActionType } from './types';

const iconMap: Record<string, LucideIcon> = {
  Users,
  Package,
  Receipt,
  ShoppingBag,
  UserPlus,
  Settings,
};

interface QuickActionsProps {
  actions: QuickActionType[];
}

export function QuickActions({ actions }: QuickActionsProps) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {actions.map((action, index) => {
          const Icon = iconMap[action.icon] ?? Settings;
          return (
            <motion.div
              key={action.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.05 }}
            >
              {action.available ? (
                <Link
                  href={action.href}
                  className="glass-card rounded-xl p-4 flex flex-col items-center gap-3 text-center hover:bg-accent/50 transition-colors group"
                >
                  <div className="rounded-lg bg-primary/10 p-2.5 group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-sm font-medium">{action.label}</span>
                </Link>
              ) : (
                <div className="glass-card rounded-xl p-4 flex flex-col items-center gap-3 text-center opacity-50 cursor-not-allowed">
                  <div className="rounded-lg bg-muted p-2.5">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">{action.label}</span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
