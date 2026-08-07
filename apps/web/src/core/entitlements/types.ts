export interface UsageLimits {
  users: number;
  customers: number;
  products: number;
  storageGb: number;
  aiCredits: number;
}

/** Static entitlement profile for a plan tier. */
export interface PlanEntitlements {
  key: string;
  name: string;
  features: Record<string, boolean>;
  modules: Record<string, boolean>;
  limits: UsageLimits;
  trialDays: number;
}

export interface EntitlementInput {
  plan?: string;
  features?: Record<string, boolean>;
  modules?: string[];
  limits?: Partial<UsageLimits>;
  status?: string;
}

export interface EntitlementContext extends PlanEntitlements {
  /** Whether the profile came from a known plan or the platform default. */
  source: 'plan' | 'default';
  status?: string;
}
