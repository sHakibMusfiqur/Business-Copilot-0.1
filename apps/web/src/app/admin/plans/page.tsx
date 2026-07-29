'use client';

import { useQuery } from '@tanstack/react-query';
import { CreditCard, Check, Loader2 } from 'lucide-react';

import { getAdminPlans } from '@/lib/api';
import type { SubscriptionPlanResponse } from '@/lib/api';

const FEATURE_ORDER = ['invoicing', 'expenses', 'reports', 'basicReports', 'advancedReports', 'inventory', 'crm', 'api', 'multipleWarehouses', 'dedicatedSupport', 'customIntegrations', 'sso', 'all'];

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(price);
}

function formatInterval(interval: string): string {
  return interval === 'YEARLY' ? 'year' : 'month';
}

function formatFeatureLabel(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

export default function AdminPlansPage() {
  const { data: plans, isLoading } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: getAdminPlans,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subscription Plans</h1>
        <p className="text-muted-foreground">Manage available subscription tiers</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
        {plans?.map((plan: SubscriptionPlanResponse) => {
          const featureEntries = plan.features
            ? Object.entries(plan.features).sort(([a], [b]) => FEATURE_ORDER.indexOf(a) - FEATURE_ORDER.indexOf(b))
            : [];

          return (
            <div key={plan.id} className="rounded-xl border bg-card p-6 flex flex-col">
              <div className="mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-3">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                {plan.description && (
                  <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                )}
              </div>

              <div className="mb-4">
                <span className="text-3xl font-bold">
                  {formatPrice(plan.price, plan.currency)}
                </span>
                <span className="text-sm text-muted-foreground">
                  /{formatInterval(plan.interval)}
                </span>
              </div>

              <div className="space-y-2 flex-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Max Users</span>
                  <span className="font-medium">{plan.maxUsers}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Max Customers</span>
                  <span className="font-medium">{plan.maxCustomers}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Max Products</span>
                  <span className="font-medium">{plan.maxProducts}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Storage</span>
                  <span className="font-medium">{plan.maxStorage} MB</span>
                </div>
                {featureEntries.map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    <Check className={`h-4 w-4 ${value ? 'text-emerald-500' : 'text-muted-foreground/30'}`} />
                    <span className={value ? '' : 'text-muted-foreground/50'}>{formatFeatureLabel(key)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  plan.isActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
                }`}>
                  {plan.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
