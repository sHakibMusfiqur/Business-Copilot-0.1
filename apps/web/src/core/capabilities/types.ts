import type { LucideIcon } from 'lucide-react';

import type { CapabilityKey } from '@/core/types';

/** Catalog entry for a business capability. */
export interface CapabilityDef {
  id: CapabilityKey;
  label: string;
  description: string;
  icon?: LucideIcon;
}

/** The capabilities granted to the current workspace context. */
export interface ResolvedCapabilities {
  granted: CapabilityKey[];
  can: (capability: CapabilityKey) => boolean;
}
