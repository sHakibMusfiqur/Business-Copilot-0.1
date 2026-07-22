'use client';

import { motion } from 'framer-motion';
import {
  Users,
  ShoppingCart,
  DollarSign,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
} from 'lucide-react';

import { formatCurrency } from '@/lib/utils';

const stats = [
  {
    label: 'Total Revenue',
    value: 128430,
    change: 12.5,
    trend: 'up',
    icon: DollarSign,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
  {
    label: 'Active Customers',
    value: 2456,
    change: 8.2,
    trend: 'up',
    icon: Users,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  {
    label: 'Pending Orders',
    value: 89,
    change: -3.1,
    trend: 'down',
    icon: ShoppingCart,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
  {
    label: 'Low Stock Items',
    value: 23,
    change: 5.7,
    trend: 'up',
    icon: Package,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
  },
];

const recentActivities = [
  { action: 'New order #INV-2024-001', user: 'John Doe', time: '2 min ago', type: 'order' },
  { action: 'Payment received $2,450', user: 'System', time: '15 min ago', type: 'payment' },
  { action: 'New customer registered', user: 'Sarah Smith', time: '1 hour ago', type: 'customer' },
  { action: 'Invoice #INV-2024-002 created', user: 'Mike Johnson', time: '2 hours ago', type: 'invoice' },
  { action: 'Product stock updated', user: 'Warehouse', time: '3 hours ago', type: 'inventory' },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your business performance
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="glass-card rounded-xl p-6"
          >
            <div className="flex items-start justify-between">
              <div className={`rounded-lg ${stat.bg} p-2.5`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                stat.trend === 'up'
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : 'bg-red-500/10 text-red-500'
              }`}>
                {stat.trend === 'up' ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {Math.abs(stat.change)}%
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-semibold mt-1">
                {stat.label === 'Total Revenue'
                  ? formatCurrency(stat.value)
                  : stat.value.toLocaleString()}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Revenue Overview</h2>
            <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center justify-center h-[250px] text-muted-foreground">
            <div className="flex flex-col items-center gap-3">
              <BarChart3Icon className="h-12 w-12 opacity-30" />
              <p className="text-sm">Chart will render here</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <button className="text-sm text-primary hover:text-primary/80">
              View all
            </button>
          </div>
          <div className="space-y-4">
            {recentActivities.map((activity, index) => (
              <div
                key={index}
                className="flex items-center gap-3 text-sm"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{activity.action}</p>
                  <p className="text-muted-foreground text-xs">
                    {activity.user} &middot; {activity.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function BarChart3Icon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="12" width="4" height="9" />
      <rect x="10" y="7" width="4" height="14" />
      <rect x="17" y="3" width="4" height="18" />
    </svg>
  );
}
