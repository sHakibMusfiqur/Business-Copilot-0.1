'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Users,
  ShieldCheck,
  AlertTriangle,
  BarChart3,
  TrendingUp,
  Activity,
  Layers,
} from 'lucide-react';

import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { StatCard } from '@/components/dashboard/stat-card';
import { getAdminDashboard } from '@/lib/api';
import type { DashboardResponse } from '@/lib/api';

export default function AdminDashboardPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => getAdminDashboard(),
    staleTime: 30_000,
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError || !data) {
    return (
      <DashboardError
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => refetch()}
      />
    );
  }

  const d = data as DashboardResponse;
  const totalUsers = d.users?.total ?? 0;
  const subscriptionList = d.subscriptions
    ? [
        { status: 'Trialing', count: d.subscriptions.trialing },
        { status: 'Active', count: d.subscriptions.active },
        { status: 'Expired', count: d.subscriptions.expired },
        { status: 'Cancelled', count: d.subscriptions.cancelled },
      ]
    : [];

  const statCards = [
    {
      label: 'Total Organizations',
      value: d.organizations?.total ?? 0,
      icon: Building2,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Active Organizations',
      value: d.organizations?.active ?? 0,
      icon: ShieldCheck,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Suspended',
      value: d.organizations?.suspended ?? 0,
      icon: AlertTriangle,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
    },
    {
      label: 'Total Users',
      value: totalUsers,
      icon: Users,
      color: 'text-violet-500',
      bg: 'bg-violet-500/10',
    },
    {
      label: 'New This Month',
      value: d.organizations?.newThisMonth ?? 0,
      icon: TrendingUp,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'Active Subscriptions',
      value: d.subscriptions?.active ?? 0,
      icon: Activity,
      color: 'text-cyan-500',
      bg: 'bg-cyan-500/10',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Platform Overview</h1>
        <p className="text-muted-foreground">Monitor your entire SaaS platform</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {statCards.map((stat, index) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            color={stat.color}
            bg={stat.bg}
            delay={index * 0.05}
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Platform Users
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Users</span>
              <span className="text-sm font-medium">{d.users?.total ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Daily Active</span>
              <span className="text-sm font-medium">{d.users?.dailyActive ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Monthly Active</span>
              <span className="text-sm font-medium">{d.users?.monthlyActive ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Growth Rate</span>
              <span className="text-sm font-medium">{d.users?.growthRate ?? 0}%</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Subscriptions by Status
          </h3>
          <div className="space-y-3">
            {subscriptionList.map((item) => (
              <div key={item.status} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{item.status}</span>
                <span className="text-sm font-medium">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
