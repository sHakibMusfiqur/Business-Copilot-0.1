import type { LucideIcon } from 'lucide-react';

import type {
  CapabilityKey,
  IndustryKey,
  ModuleStatus,
  ModuleVisibility,
} from '@/core/types';

/** Sidebar category a module belongs to. */
export type ModuleCategory =
  | 'Workspace'
  | 'Relations'
  | 'Operations'
  | 'Finance'
  | 'People'
  | 'Administration'
  | 'Analytics';

/** Typed settings a module can declare; consumed by future engines. */
export interface ModuleSettings {
  order?: number;
  standalone?: boolean;
  quickAccess?: boolean;
}

export interface ModuleManifest {
  id: string;
  name: string;
  description?: string;
  icon: LucideIcon;
  category: ModuleCategory;
  route: string;
  permissions: string[];
  capabilities: CapabilityKey[];
  settings?: ModuleSettings;
  status: ModuleStatus;
  visibility?: ModuleVisibility;
  dependencies?: string[];
  industries?: IndustryKey[];
}
