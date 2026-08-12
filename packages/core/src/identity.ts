import type { CapabilityKey } from './capabilities';

/** Resolved workspace roles, aligned with the web kernel role profiles. */
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

/** Lifecycle status of a registered module. */
export type ModuleStatus = 'stable' | 'beta' | 'experimental';

/** Sidebar category a module belongs to. */
export type ModuleCategory =
  | 'Workspace'
  | 'Relations'
  | 'Operations'
  | 'Finance'
  | 'People'
  | 'Administration'
  | 'Analytics';

/** Declarative visibility rules evaluated by the Manifest Engine. */
export interface ModuleVisibility {
  roles?: RoleKey[];
  industries?: IndustryKey[];
  always?: boolean;
}

/**
 * Module identity. UI presentation fields (e.g. the icon) are intentionally
 * omitted so the contract stays framework-agnostic.
 */
export interface ModuleManifest {
  id: string;
  name: string;
  description?: string;
  category: ModuleCategory;
  route: string;
  permissions: string[];
  capabilities: CapabilityKey[];
  status: ModuleStatus;
  visibility?: ModuleVisibility;
  dependencies?: string[];
  industries?: IndustryKey[];
}