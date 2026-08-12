export type CapabilityKey =
  | 'dashboard'
  | 'analytics'
  | 'reports'
  | 'crm'
  | 'accounting'
  | 'finance'
  | 'inventory'
  | 'procurement'
  | 'manufacturing'
  | 'hr'
  | 'payroll'
  | 'pos'
  | 'ecommerce'
  | 'ai'
  | 'workflow'
  | 'administration'
  | 'platform';

/** Catalog entry for a business capability. */
export interface CapabilityDef {
  id: CapabilityKey;
  label: string;
  description: string;
}

/** The capabilities granted to the current workspace context. */
export interface ResolvedCapabilities {
  granted: CapabilityKey[];
  can: (capability: CapabilityKey) => boolean;
}