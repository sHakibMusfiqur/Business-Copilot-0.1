import { api } from './client';
import { API_ROUTES } from './routes';

import type {
  BillingInterval,
  BillingSubscriptionPlan,
  InvoiceStatus,
  PaymentStatus,
  SubscriptionPlanResponse,
  SubscriptionStatus,
} from '@bc/types';

export type {
  BillingInterval,
  BillingSubscriptionPlan,
  InvoiceStatus,
  PaymentStatus,
  SubscriptionPlanResponse,
  SubscriptionStatus,
} from '@bc/types';

export interface BillingSubscription {
  id: string;
  organizationId: string;
  planId: string;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
  trialDaysRemaining: number;
  canceledAt: string | null;
  plan: BillingSubscriptionPlan;
}

export interface BillingPayment {
  id: string;
  amount: number;
  currency: string;
  billingInterval: BillingInterval;
  status: PaymentStatus;
  gateway: string | null;
  transactionRef: string | null;
  paidAt: string | null;
  createdAt: string;
  plan: { name: string; slug: string } | null;
}

export interface BillingInvoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  billingInterval: BillingInterval;
  status: InvoiceStatus;
  issuedAt: string;
  dueAt: string | null;
  paidAt: string | null;
  pdfUrl: string | null;
}

export interface PaymentGateway {
  id: string;
  code: string;
  name: string;
  isEnabled: boolean;
  config: Record<string, unknown> | null;
  sortOrder: number;
}

export async function getBillingPlans(signal?: AbortSignal): Promise<SubscriptionPlanResponse[]> {
  const response = await api.get(API_ROUTES.BILLING.PLANS, { signal });
  return response.data;
}

export async function getPaymentGateways(signal?: AbortSignal): Promise<PaymentGateway[]> {
  const response = await api.get(API_ROUTES.BILLING.GATEWAYS, { signal });
  return response.data;
}

export async function getSubscription(signal?: AbortSignal): Promise<BillingSubscription | null> {
  const response = await api.get(API_ROUTES.BILLING.SUBSCRIPTION, { signal });
  return response.data;
}

export async function startFreeTrial(
  planId: string,
  billingInterval?: BillingInterval,
): Promise<BillingSubscription> {
  const response = await api.post(API_ROUTES.BILLING.TRIAL, { planId, billingInterval });
  return response.data;
}

export async function changeSubscriptionPlan(
  planId: string,
  billingInterval?: BillingInterval,
): Promise<BillingSubscription> {
  const response = await api.post(API_ROUTES.BILLING.CHANGE_PLAN, { planId, billingInterval });
  return response.data;
}

export async function getPaymentHistory(signal?: AbortSignal): Promise<BillingPayment[]> {
  const response = await api.get(API_ROUTES.BILLING.PAYMENTS, { signal });
  return response.data;
}

export async function getBillingInvoices(signal?: AbortSignal): Promise<BillingInvoice[]> {
  const response = await api.get(API_ROUTES.BILLING.INVOICES, { signal });
  return response.data;
}

export interface CheckoutSession {
  paymentId: string;
  checkoutUrl: string;
  gateway: string;
  sessionRef: string;
}

export interface VerifiedPayment {
  payment: {
    id: string;
    amount: number;
    currency: string;
    billingInterval: BillingInterval;
    status: PaymentStatus;
    gateway: string | null;
    transactionRef: string | null;
    paidAt: string | null;
    createdAt: string;
  };
  subscription: BillingSubscription | null;
  invoice: BillingInvoice | null;
}

export async function createCheckoutSession(
  planId: string,
  billingInterval?: BillingInterval,
): Promise<CheckoutSession> {
  const response = await api.post(API_ROUTES.BILLING.CHECKOUT, { planId, billingInterval });
  return response.data;
}

export async function verifyPayment(paymentId: string): Promise<VerifiedPayment> {
  const response = await api.post(API_ROUTES.BILLING.VERIFY, { paymentId });
  return response.data;
}

export async function refundPayment(paymentId: string, amount?: number): Promise<VerifiedPayment> {
  const response = await api.post(API_ROUTES.BILLING.REFUND, { paymentId, amount });
  return response.data;
}
