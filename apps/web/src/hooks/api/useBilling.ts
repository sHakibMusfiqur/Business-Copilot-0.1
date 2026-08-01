import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  changeSubscriptionPlan,
  getBillingInvoices,
  getBillingPlans,
  getPaymentGateways,
  getPaymentHistory,
  getSubscription,
  startFreeTrial,
} from '@/lib/api';
import type { BillingInterval } from '@/lib/api';

export function useBillingPlans() {
  return useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: () => getBillingPlans(),
  });
}

export function useSubscription() {
  return useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: () => getSubscription(),
  });
}

export function usePaymentGateways() {
  return useQuery({
    queryKey: ['billing', 'gateways'],
    queryFn: () => getPaymentGateways(),
  });
}

export function usePaymentHistory() {
  return useQuery({
    queryKey: ['billing', 'payments'],
    queryFn: () => getPaymentHistory(),
  });
}

export function useBillingInvoices() {
  return useQuery({
    queryKey: ['billing', 'invoices'],
    queryFn: () => getBillingInvoices(),
  });
}

export function useStartFreeTrial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { planId: string; billingInterval?: BillingInterval }) =>
      startFreeTrial(args.planId, args.billingInterval),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
  });
}

export function useChangeSubscriptionPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { planId: string; billingInterval?: BillingInterval }) =>
      changeSubscriptionPlan(args.planId, args.billingInterval),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
  });
}
