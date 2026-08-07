
export type RoleKey =
  | 'super-admin'
  | 'owner'
  | 'ceo'
  | 'coo'
  | 'manager'
  | 'finance'
  | 'hr'
  | 'sales'
  | 'inventory'
  | 'support'
  | 'employee'
  | 'guest';

/** Industry identifiers aligned with the provisioning templates. */
export type IndustryKey =
  | 'restaurant'
  | 'hospital'
  | 'manufacturing'
  | 'school'
  | 'software'
  | 'retail'
  | 'pharmacy'
  | 'garments'
  | 'it-services'
  | 'general';

/**
 * Canonical business capabilities. The Capability Engine resolves the subset
 * granted to the current workspace. Future modules declare which capabilities
 * they provide; consumers gate against capabilities instead of module ids.
 */
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

/** Lifecycle status of a registered module. */
export type ModuleStatus = 'stable' | 'beta' | 'experimental';

/** Declarative visibility rules evaluated by the Manifest Engine. */
export interface ModuleVisibility {
  roles?: RoleKey[];
  industries?: IndustryKey[];
  always?: boolean;
}
