export type BillingInterval = 'MONTHLY' | 'YEARLY';

export type SubscriptionStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELLED'
  | 'EXPIRED';

export type PaymentStatus =
  | 'PENDING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REFUNDED'
  | 'CANCELLED';

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE' | 'VOID';

export interface SubscriptionPlanResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  yearlyPrice: number | null;
  currency: string;
  interval: string;
  freeTrialDays: number;
  aiCredits: number;
  reportsEnabled: boolean;
  apiAccess: boolean;
  integrations: string[] | null;
  prioritySupport: boolean;
  customBranding: boolean;
  securityFeatures: string[] | null;
  recommended: boolean;
  sortOrder: number;
  features: Record<string, boolean> | null;
  modules: string[] | null;
  maxUsers: number;
  maxCustomers: number;
  maxProducts: number;
  maxStorage: number;
  isActive: boolean;
}

export interface BillingSubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  yearlyPrice: number | null;
  currency: string;
  interval: string;
  freeTrialDays: number;
  maxUsers: number;
  maxStorage: number;
}
