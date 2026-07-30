'use client';

import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Building2,
  Package,
  Truck,
  Receipt,
  ShoppingBag,
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
} from 'lucide-react';

import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { DashboardError } from '@/components/dashboard/dashboard-error';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { ActivityTimeline } from '@/components/dashboard/activity-timeline';
import { OnboardingWidget } from '@/components/dashboard/onboarding-widget';
import { DashboardCard, cardClass } from '@/components/ui/dashboard-card';
import { TrendBadge } from '@/components/ui/trend-badge';
import type { DashboardOverview } from '@/components/dashboard/types';
import { getDashboardOverview } from '@/lib/api';
import { formatCurrency, formatNumber } from '@/lib/utils';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
};

const cardMotionClass = `${cardClass} group cursor-pointer hover:-translate-y-0.5`;

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[2px] h-7">
      {data.map((v, i) => (
        <div
          key={i}
          className={`w-[3px] rounded-full ${color}`}
          style={{ height: `${(v / max) * 100}%` }}
        />
      ))}
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, trend, trendPositive, subtitle }: {
  label: string;
  value: string;
  icon: typeof DollarSign;
  trend?: string;
  trendPositive?: boolean;
  subtitle?: string;
}) {
  return (
    <motion.div variants={itemVariants} className={cardMotionClass}>
      <div className="p-5">
        <div className="flex items-start justify-between mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-50 to-red-100 group-hover:from-red-100 group-hover:to-red-200 transition-all duration-200">
            <Icon className="h-5 w-5 text-red-500" />
          </div>
          {trend && <TrendBadge value={trend} positive={trendPositive ?? true} />}
        </div>
        <p className="text-2xl font-bold tracking-tight text-slate-900 mb-0.5">{value}</p>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className="mt-2.5 flex items-center justify-between">
          {trend && (
            <Sparkline
              data={[30, 45, 38, 52, 48, 65, 55, 72, 68, 78, 85, 95].map(v => trendPositive ? v : 100 - v)}
              color={trendPositive ? 'bg-emerald-400/60' : 'bg-red-400/60'}
            />
          )}
          {subtitle && <span className="text-[10px] text-slate-400 ml-auto">{subtitle}</span>}
        </div>
      </div>
    </motion.div>
  );
}

function MiniChartCard({ title, value, trend, trendPositive }: {
  title: string;
  value: string;
  trend?: string;
  trendPositive?: boolean;
}) {
  return (
    <DashboardCard className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</h4>
        {trend && (
          <span className={`text-[11px] font-medium ${trendPositive ? 'text-emerald-600' : 'text-red-600'}`}>
            {trendPositive ? '+' : ''}{trend}
          </span>
        )}
      </div>
      <p className="text-xl font-bold text-slate-900 mb-2">{value}</p>
      <div className="flex items-end gap-[2px] h-12">
        {[35, 55, 42, 68, 51, 74, 63, 82, 70, 90, 78, 95].map((h, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-px">
            <div className="w-full rounded-t-sm bg-red-500/70" style={{ height: `${h * 0.5}px` }} />
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

function SecondaryStatCard({ icon: Icon, value, label, bg, color }: {
  icon: typeof DollarSign;
  value: string;
  label: string;
  bg: string;
  color: string;
}) {
  return (
    <motion.div variants={itemVariants} className={cardClass}>
      <div className="p-4 flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg} ${color} shrink-0`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-slate-900 leading-6">{value}</p>
          <p className="text-xs font-medium text-slate-500 truncate">{label}</p>
        </div>
      </div>
    </motion.div>
  );
}

function AlertCard({ icon: Icon, value, label, bg, color }: {
  icon: typeof AlertTriangle;
  value: number;
  label: string;
  bg: string;
  color: string;
}) {
  return (
    <motion.div variants={itemVariants} className={cardClass}>
      <div className="p-4 flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg} ${color} shrink-0`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-lg font-bold text-slate-900">{value}</p>
          <p className="text-xs font-medium text-slate-500">{label}</p>
        </div>
      </div>
    </motion.div>
  );
}

function AiInsightCard({ icon: Icon, text }: { icon: typeof Zap; text: string }) {
  return (
    <div className="flex items-start gap-3 cursor-default">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-sm text-white/80 leading-relaxed">{text}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, isError, error, refetch } = useQuery<DashboardOverview>({
    queryKey: ['dashboard', 'overview'],
    queryFn: getDashboardOverview,
  });

  if (isLoading) return <DashboardSkeleton />;

  if (isError || !data) {
    const status = error instanceof AxiosError ? error.response?.status : undefined;
    return <DashboardError status={status} message={error instanceof Error ? error.message : undefined} onRetry={() => refetch()} />;
  }

  const { organization, statistics, quickActions, recentActivities } = data;
  const netProfit = statistics.monthlyRevenue - statistics.monthlyExpense;
  const profitMargin = statistics.monthlyRevenue > 0 ? ((netProfit / statistics.monthlyRevenue) * 100).toFixed(1) : '0.0';

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants}>
        <DashboardHeader organizationName={organization.name} />
      </motion.div>

      <motion.div variants={itemVariants}>
        <OnboardingWidget />
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Monthly Revenue" value={formatCurrency(statistics.monthlyRevenue)} icon={TrendingUp} trend="+18.2%" trendPositive subtitle="Last 30 days" />
        <KpiCard label="Monthly Expenses" value={formatCurrency(statistics.monthlyExpense)} icon={TrendingDown} trend="-3.2%" trendPositive={false} subtitle="Last 30 days" />
        <KpiCard label="Net Profit" value={formatCurrency(netProfit)} icon={DollarSign} trend={`+${profitMargin}%`} trendPositive={netProfit >= 0} subtitle={`${profitMargin}% margin`} />
        <KpiCard label="Total Customers" value={formatNumber(statistics.totalCustomers)} icon={Users} trend="+8.1%" trendPositive subtitle="Active accounts" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MiniChartCard title="Revenue Trend" value={formatCurrency(statistics.monthlyRevenue)} trend="12.5%" trendPositive />
        <MiniChartCard title="Cash Flow" value={formatCurrency(netProfit)} trend={profitMargin} trendPositive={netProfit >= 0} />
        <MiniChartCard title="Sales Trend" value={formatNumber(statistics.totalInvoices + statistics.totalPurchaseOrders)} trend="5.2%" trendPositive />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SecondaryStatCard icon={Receipt} value={formatNumber(statistics.totalInvoices)} label="Total Invoices" bg="bg-rose-50" color="text-rose-600" />
        <SecondaryStatCard icon={Package} value={formatNumber(statistics.totalProducts)} label="Total Products" bg="bg-violet-50" color="text-violet-600" />
        <SecondaryStatCard icon={Truck} value={formatNumber(statistics.totalSuppliers)} label="Total Suppliers" bg="bg-amber-50" color="text-amber-600" />
        <SecondaryStatCard icon={Building2} value={formatNumber(statistics.totalUsers)} label="Total Users" bg="bg-blue-50" color="text-blue-600" />
      </div>

      {(statistics.lowStockProducts > 0 || statistics.totalPurchaseOrders > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {statistics.lowStockProducts > 0 && (
            <AlertCard icon={AlertTriangle} value={statistics.lowStockProducts} label="Low Stock Products — reorder soon" bg="bg-amber-50" color="text-amber-600" />
          )}
          {statistics.totalPurchaseOrders > 0 && (
            <AlertCard icon={ShoppingBag} value={statistics.totalPurchaseOrders} label="Purchase Orders placed" bg="bg-cyan-50" color="text-cyan-600" />
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={itemVariants}>
          <ActivityTimeline activities={recentActivities} />
        </motion.div>
        <motion.div variants={itemVariants}>
          <QuickActions actions={quickActions} />
        </motion.div>
      </div>

      <motion.div variants={itemVariants} className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-xl overflow-hidden">
        <div className="relative p-6 sm:p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-red-500/5 rounded-full blur-3xl" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500 shadow-lg shadow-red-500/25">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Business Copilot</h3>
                <p className="text-sm text-slate-400">AI-powered insights for your business</p>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-red-400" />
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Today&apos;s AI Insights</h4>
                </div>
                <div className="space-y-3">
                  <AiInsightCard icon={Zap} text="Revenue increased 12.5% compared to last month. Your top-performing category is driving this growth." />
                  <AiInsightCard icon={BarChart3} text={`${statistics.totalInvoices} total invoices on record. Consider automating reminders for overdue payments.`} />
                  {statistics.lowStockProducts > 0 && <AiInsightCard icon={AlertTriangle} text={`${statistics.lowStockProducts} products running low on stock. Restock alerts are ready for review.`} />}
                  <AiInsightCard icon={ArrowUpRight} text="Customer acquisition up 8.1%. Projected to reach 2,000 customers next quarter." />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-red-400" />
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Quick Actions</h4>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button className="flex items-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-3 text-sm text-slate-300 hover:text-white transition-all">
                    <Bot className="h-4 w-4 text-red-400" />
                    Ask AI
                  </button>
                  <button className="flex items-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-3 text-sm text-slate-300 hover:text-white transition-all">
                    <LineChart className="h-4 w-4 text-red-400" />
                    Forecast Sales
                  </button>
                  <button className="flex items-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-3 text-sm text-slate-300 hover:text-white transition-all">
                    <BarChart3 className="h-4 w-4 text-red-400" />
                    Generate Report
                  </button>
                  <button className="flex items-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-3 text-sm text-slate-300 hover:text-white transition-all">
                    <PieChart className="h-4 w-4 text-red-400" />
                    Analyze Expenses
                  </button>
                </div>

                <button className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-500 hover:bg-red-600 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-red-500/25 transition-all">
                  <Sparkles className="h-4 w-4" />
                  Open AI Assistant
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
