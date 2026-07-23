'use client';

import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import {
  Users,
  Building2,
  Package,
  Truck,
  Receipt,
  ShoppingBag,
  AlertTriangle,
  DollarSign,
  TrendingDown,
} from 'lucide-react';

import { ActivityTimeline } from '@/components/dashboard/activity-timeline';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { OrganizationCard } from '@/components/dashboard/organization-card';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { StatCard } from '@/components/dashboard/stat-card';
import type { DashboardOverview } from '@/components/dashboard/types';
import { getDashboardOverview } from '@/lib/api';

export default function DashboardPage() {
  const { data, isLoading, isError, error, refetch } = useQuery<DashboardOverview>({
    queryKey: ['dashboard', 'overview'],
    queryFn: getDashboardOverview,
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError || !data) {
    const status = error instanceof AxiosError ? error.response?.status : undefined;
    return (
      <DashboardError
        status={status}
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => refetch()}
      />
    );
  }

  const { organization, statistics, quickActions, recentActivities } = data;

  const statCards = [
    { label: 'Users', value: statistics.totalUsers, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Customers', value: statistics.totalCustomers, icon: Building2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Products', value: statistics.totalProducts, icon: Package, color: 'text-violet-500', bg: 'bg-violet-500/10' },
    { label: 'Suppliers', value: statistics.totalSuppliers, icon: Truck, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'Invoices', value: statistics.totalInvoices, icon: Receipt, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { label: 'Purchase Orders', value: statistics.totalPurchaseOrders, icon: ShoppingBag, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
    { label: 'Monthly Revenue', value: statistics.monthlyRevenue, icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-500/10', isCurrency: true },
    { label: 'Monthly Expense', value: statistics.monthlyExpense, icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-500/10', isCurrency: true },
    { label: 'Low Stock Products', value: statistics.lowStockProducts, icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  ];

  return (
    <div className="space-y-8">
      <DashboardHeader organizationName={organization.name} />

      <OrganizationCard organization={organization} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {statCards.slice(0, 8).map((stat, index) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            color={stat.color}
            bg={stat.bg}
            isCurrency={stat.isCurrency}
            delay={index * 0.05}
          />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label={statCards[8].label}
          value={statCards[8].value}
          icon={statCards[8].icon}
          color={statCards[8].color}
          bg={statCards[8].bg}
          delay={0.4}
        />
      </div>

      <QuickActions actions={quickActions} />

      <ActivityTimeline activities={recentActivities} />
    </div>
  );
}
