'use client';

import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  ShoppingBag,
  Wallet,
  Building2,
  Package,
  Truck,
  Receipt,
  CalendarClock,
  AlertTriangle,
  BarChart3,
  Zap,
  ArrowUpRight,
  Bot,
  Wand2,
  LineChart,
  PieChart,
  Sparkles,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect } from 'react';

import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { ActivityTimeline } from '@/components/dashboard/activity-timeline';
import { OnboardingWidget } from '@/components/dashboard/onboarding-widget';
import { SubscriptionBanner } from '@/components/dashboard/subscription-banner';
import { Sparkline, TrendChart } from '@/components/dashboard/charts';
import { TrendBadge } from '@/components/ui/trend-badge';
import type { DashboardOverview, DashboardPanelKey, DashboardStatistics } from '@/components/dashboard/types';
import { getDashboardOverview } from '@/lib/api';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
};

function buildSeries(value: number, seed: number): number[] {
  const base = Math.max(value / 100, 1);
  return Array.from({ length: 12 }, (_, i) =>
    Math.round((base * (0.5 + 0.08 * Math.sin(i * 1.05 + seed)) + i * base * 0.045) * 100) / 100,
  );
}

function MetricCard({ label, value, icon: Icon, trend, trendPositive, accent, spark }: {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
  trendPositive?: boolean;
  accent: string;
  spark: number[];
}) {
  return (
    <motion.div variants={itemVariants} className="panel-card panel-card-hover p-4">
      <div className="flex items-start justify-between gap-2">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-[10px]"
          style={{ background: `${accent}14`, color: accent }}
        >
          <Icon className="h-4 w-4" />
        </div>
        {trend && <TrendBadge value={trend} positive={trendPositive ?? true} />}
      </div>
      <p className="mt-3 text-[26px] font-bold leading-8 tracking-tight tabular-nums sm:text-[32px] sm:leading-9">{value}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <Sparkline data={spark} color={accent} className="h-7 w-16" />
      </div>
    </motion.div>
  );
}

function ChartCard({ title, value, trend, trendPositive, accent, series }: {
  title: string;
  value: string;
  trend?: string;
  trendPositive?: boolean;
  accent: string;
  series: number[];
}) {
  return (
    <motion.div variants={itemVariants} className="panel-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-[15px] font-semibold leading-snug tracking-tight">{title}</h4>
          <p className="mt-1 text-[26px] font-bold leading-8 tracking-tight tabular-nums">{value}</p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border ${
            trendPositive
              ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400'
              : 'border-red-200 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400'
          }`}
        >
          {trendPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {trendPositive ? '+' : ''}{trend}
        </span>
      </div>
      <div className="mt-3">
        <TrendChart height={130} series={[{ data: series, color: accent, label: title }]} />
      </div>
    </motion.div>
  );
}

function SecondaryStatCard({ icon: Icon, value, label }: {
  icon: LucideIcon;
  value: string;
  label: string;
  accent?: string;
}) {
  return (
    <motion.div variants={itemVariants} className="panel-card-subtle">
      <div className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-slate-100 text-slate-500 dark:bg-white/[0.08] dark:text-slate-400">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold leading-6 tabular-nums">{value}</p>
          <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        </div>
      </div>
    </motion.div>
  );
}

function AlertCard({ icon: Icon, value, label, accent }: {
  icon: LucideIcon;
  value: number;
  label: string;
  accent?: string;
}) {
  const isWarning = accent === '#F59E0B';
  return (
    <motion.div variants={itemVariants} className="panel-card-subtle">
      <div className="flex items-center gap-3 p-4">
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]', isWarning ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-slate-100 text-slate-500 dark:bg-white/[0.08] dark:text-slate-400')}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-lg font-bold leading-6 tabular-nums">{value}</p>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        </div>
      </div>
    </motion.div>
  );
}

function AiInsightCard({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-slate-100 text-slate-500 dark:bg-white/[0.08] dark:text-slate-400">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{text}</p>
    </div>
  );
}

const AI_INSIGHT_ICONS: Record<string, LucideIcon> = {
  Zap,
  BarChart3,
  AlertTriangle,
  ArrowUpRight,
  Wallet,
  ShoppingBag,
  Sparkles,
};

function renderKpiCard(key: DashboardPanelKey, statistics: DashboardStatistics, netProfit: number, profitMargin: string) {
  switch (key) {
    case 'revenue':
      return <MetricCard label="Monthly Revenue" value={formatCurrency(statistics.monthlyRevenue)} icon={TrendingUp} trend="+18.2%" trendPositive accent="#2563EB" spark={buildSeries(statistics.monthlyRevenue, 1)} />;
    case 'expenses':
      return <MetricCard label="Monthly Expenses" value={formatCurrency(statistics.monthlyExpense)} icon={TrendingDown} trend="-3.2%" trendPositive={false} accent="#DC2626" spark={buildSeries(statistics.monthlyExpense, 4)} />;
    case 'netProfit':
      return <MetricCard label="Net Profit" value={formatCurrency(netProfit)} icon={DollarSign} trend={`+${profitMargin}%`} trendPositive={netProfit >= 0} accent="#16A34A" spark={buildSeries(netProfit, 7)} />;
    case 'customers':
      return <MetricCard label="Total Customers" value={formatNumber(statistics.totalCustomers)} icon={Users} trend="+8.1%" trendPositive accent="#7C3AED" spark={buildSeries(statistics.totalCustomers * 100, 10)} />;
    case 'sales':
      return <MetricCard label="Sales Orders" value={formatNumber(statistics.totalSalesOrders)} icon={ShoppingBag} trend="+5.2%" trendPositive accent="#06B6D4" spark={buildSeries(statistics.totalSalesOrders * 100, 13)} />;
    case 'employees':
      return <MetricCard label="Total Employees" value={formatNumber(statistics.totalEmployees)} icon={Users} trend="+2.4%" trendPositive accent="#0EA5E9" spark={buildSeries(statistics.totalEmployees * 100, 16)} />;
    case 'payroll':
      return <MetricCard label="Monthly Payroll" value={formatCurrency(statistics.monthlyPayroll)} icon={Wallet} trend="-1.1%" trendPositive={false} accent="#16A34A" spark={buildSeries(statistics.monthlyPayroll, 19)} />;
    default:
      return null;
  }
}

function renderChartCard(key: DashboardPanelKey, statistics: DashboardStatistics, netProfit: number, profitMargin: string) {
  switch (key) {
    case 'revenueTrend':
      return <ChartCard title="Revenue Trend" value={formatCurrency(statistics.monthlyRevenue)} trend="12.5" trendPositive accent="#2563EB" series={buildSeries(statistics.monthlyRevenue, 1)} />;
    case 'cashFlow':
      return <ChartCard title="Cash Flow" value={formatCurrency(netProfit)} trend={profitMargin} trendPositive={netProfit >= 0} accent="#16A34A" series={buildSeries(netProfit, 7)} />;
    case 'salesTrend':
      return <ChartCard title="Sales Trend" value={formatNumber(statistics.totalSalesOrders)} trend="5.2" trendPositive accent="#7C3AED" series={buildSeries(statistics.totalSalesOrders * 100, 13)} />;
    default:
      return null;
  }
}

function renderSecondaryCard(key: DashboardPanelKey, statistics: DashboardStatistics) {
  switch (key) {
    case 'invoices':
      return <SecondaryStatCard icon={Receipt} value={formatNumber(statistics.totalInvoices)} label="Total Invoices" accent="#F43F5E" />;
    case 'products':
      return <SecondaryStatCard icon={Package} value={formatNumber(statistics.totalProducts)} label="Total Products" accent="#7C3AED" />;
    case 'suppliers':
      return <SecondaryStatCard icon={Truck} value={formatNumber(statistics.totalSuppliers)} label="Total Suppliers" accent="#F59E0B" />;
    case 'users':
      return <SecondaryStatCard icon={Building2} value={formatNumber(statistics.totalUsers)} label="Total Users" accent="#2563EB" />;
    case 'pendingLeaves':
      return <SecondaryStatCard icon={CalendarClock} value={formatNumber(statistics.pendingLeaves)} label="Pending Leaves" accent="#0EA5E9" />;
    default:
      return null;
  }
}

function renderAlertCard(key: DashboardPanelKey, statistics: DashboardStatistics) {
  switch (key) {
    case 'lowStock':
      return statistics.lowStockProducts > 0 ? (
        <AlertCard icon={AlertTriangle} value={statistics.lowStockProducts} label="Low Stock Products — reorder soon" accent="#F59E0B" />
      ) : null;
    case 'purchaseOrders':
      return statistics.totalPurchaseOrders > 0 ? (
        <AlertCard icon={ShoppingBag} value={statistics.totalPurchaseOrders} label="Purchase Orders placed" accent="#06B6D4" />
      ) : null;
    default:
      return null;
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, isError, error, refetch } = useQuery<DashboardOverview>({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => getDashboardOverview(),
  });

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') router.replace('/admin');
  }, [user, router]);

  if (user?.role === 'SUPER_ADMIN') return null;

  if (isLoading) return <DashboardSkeleton />;

  if (isError || !data) {
    const status = error instanceof AxiosError ? error.response?.status : undefined;
    return <DashboardError status={status} message={error instanceof Error ? error.message : undefined} onRetry={() => refetch()} />;
  }

  const { organization, statistics, quickActions, recentActivities, layout, aiInsights, permissions } = data;
  const netProfit = statistics.monthlyRevenue - statistics.monthlyExpense;
  const profitMargin = statistics.monthlyRevenue > 0 ? ((netProfit / statistics.monthlyRevenue) * 100).toFixed(1) : '0.0';

  const can = (...required: string[]) => required.some((permission) => permissions.includes(permission));
  const kpiCards = layout.kpis
    .map((key, index) => {
      const card = renderKpiCard(key, statistics, netProfit, profitMargin);
      return card ? <Fragment key={`kpi-${key}-${index}`}>{card}</Fragment> : null;
    })
    .filter(Boolean);
  const chartCards = layout.charts
    .map((key, index) => {
      const card = renderChartCard(key, statistics, netProfit, profitMargin);
      return card ? <Fragment key={`chart-${key}-${index}`}>{card}</Fragment> : null;
    })
    .filter(Boolean);
  const secondaryCards = layout.secondary
    .map((key, index) => {
      const card = renderSecondaryCard(key, statistics);
      return card ? <Fragment key={`secondary-${key}-${index}`}>{card}</Fragment> : null;
    })
    .filter(Boolean);
  const alertCards = layout.alerts
    .map((key, index) => {
      const card = renderAlertCard(key, statistics);
      return card ? <Fragment key={`alert-${key}-${index}`}>{card}</Fragment> : null;
    })
    .filter(Boolean);
  const showActivity = layout.activity && recentActivities.length > 0;
  const showQuickActions = quickActions.length > 0;
  const showBottomGrid = showActivity || showQuickActions;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants}>
        <DashboardHeader organizationName={organization.name} />
      </motion.div>

      <motion.div variants={itemVariants}>
        <OnboardingWidget />
      </motion.div>

      <motion.div variants={itemVariants}>
        <SubscriptionBanner />
      </motion.div>

      {kpiCards.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{kpiCards}</div>
      )}

      {chartCards.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{chartCards}</div>
      )}

      {secondaryCards.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{secondaryCards}</div>
      )}

      {alertCards.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2">{alertCards}</div>
      )}

      {showBottomGrid && (
        <div className={cn('grid gap-5', showActivity && showQuickActions ? 'lg:grid-cols-2' : 'lg:grid-cols-1')}>
          {showActivity && (
            <motion.div variants={itemVariants}>
              <ActivityTimeline activities={recentActivities} />
            </motion.div>
          )}
          {showQuickActions && (
            <motion.div variants={itemVariants}>
              <QuickActions actions={quickActions} />
            </motion.div>
          )}
        </div>
      )}

      {layout.aiCopilot && (
        <motion.div variants={itemVariants} className="panel-card relative overflow-hidden p-5">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-slate-400/[0.06] dark:bg-white/[0.03] blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#2563EB] to-[#7C3AED] text-white dark:from-[#3B82F6] dark:to-[#8B5CF6]">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold">Business Copilot</h3>
                <p className="text-[13px] text-slate-500 dark:text-slate-400">AI-powered insights for your business</p>
              </div>
              <span className="ml-auto hidden items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 sm:inline-flex dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                <Sparkles className="h-3 w-3" />
                AI Active
              </span>
            </div>

            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Today&apos;s AI Insights</h4>
                </div>
                {aiInsights.map((insight) => {
                  const Icon = AI_INSIGHT_ICONS[insight.icon] ?? Sparkles;
                  return <AiInsightCard key={insight.id} icon={Icon} text={insight.text} />;
                })}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Quick Actions</h4>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button className="flex items-center gap-2 rounded-[10px] border border-border bg-card px-3 py-2.5 text-sm text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:border-white/[0.16] dark:hover:text-white">
                    <Bot className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    Ask AI
                  </button>
                  {can('sales.read') && (
                    <button className="flex items-center gap-2 rounded-[10px] border border-border bg-card px-3 py-2.5 text-sm text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:border-white/[0.16] dark:hover:text-white">
                      <LineChart className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                      Forecast Sales
                    </button>
                  )}
                  {can('reports.read') && (
                    <button className="flex items-center gap-2 rounded-[10px] border border-border bg-card px-3 py-2.5 text-sm text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:border-white/[0.16] dark:hover:text-white">
                      <BarChart3 className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                      Generate Report
                    </button>
                  )}
                  {can('invoices.read', 'payments.read', 'accounting.read') && (
                    <button className="flex items-center gap-2 rounded-[10px] border border-border bg-card px-3 py-2.5 text-sm text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:border-white/[0.16] dark:hover:text-white">
                      <PieChart className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                      Analyze Expenses
                    </button>
                  )}
                </div>

                <button className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90">
                  <Sparkles className="h-4 w-4" />
                  Open AI Assistant
                  <ArrowRight className="ml-auto h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
