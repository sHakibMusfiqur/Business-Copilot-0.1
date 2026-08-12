import type { CapabilityKey } from '@bc/core';
import type { ModuleManifest } from '@/core/modules/types';

import type { ResolvedCapabilities } from './types';


export interface CapabilityEngine {
  resolve(enabledModules: ModuleManifest[], roleKey?: string): ResolvedCapabilities;
}

export function createCapabilityEngine(): CapabilityEngine {
  return {
    resolve(enabledModules, roleKey) {
      const granted = new Set<CapabilityKey>(['dashboard']);
      for (const manifest of enabledModules) {
        for (const capability of manifest.capabilities) {
          granted.add(capability);
        }
      }
      if (roleKey === 'super-admin') {
        granted.add('platform');
      }
      return {
        granted: Array.from(granted),
        can: (capability) => granted.has(capability),
      };
    },
  };
}
