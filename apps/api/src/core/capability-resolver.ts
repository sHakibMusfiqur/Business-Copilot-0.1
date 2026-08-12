import type {
  CapabilityKey,
  ModuleManifest,
  ResolvedCapabilities,
} from '@bc/core';


const CANONICAL_CAPABILITY_KEYS: readonly CapabilityKey[] = [
  'dashboard',
  'analytics',
  'reports',
  'crm',
  'accounting',
  'finance',
  'inventory',
  'procurement',
  'manufacturing',
  'hr',
  'payroll',
  'pos',
  'ecommerce',
  'ai',
  'workflow',
  'administration',
  'platform',
];

function isValidCapabilityKey(value: string): value is CapabilityKey {
  return (CANONICAL_CAPABILITY_KEYS as readonly string[]).includes(value);
}

/**
 * Framework-independent capability resolver. Derives the set of granted
 * capabilities from a list of available modules and the canonical
 * `@bc/core` contracts.
 *
 * Pure and deterministic:
 *  - `dashboard` is always granted.
 *  - Every module's declared capabilities are merged, de-duplicated, and
 *    filtered to canonical keys only (unknown strings are ignored).
 *  - An optional `enabledCapabilities` allow-list restricts module-derived
 *    capabilities (keeping `dashboard` unconditional).
 *  - Results are sorted, so output order does not depend on module registration
 *    order.
 *  - It never queries a DB, touches HTTP/user objects, inspects Prisma, mutates
 *    inputs, performs entitlement/plan lookups, or keeps mutable state between
 *    `resolve()` calls.
 */
export class CapabilityResolver {
  resolve(
    modules: readonly ModuleManifest[],
    enabledCapabilities?: readonly string[] | null,
  ): ResolvedCapabilities {
    // Base capability plus every canonical capability declared by a module.
    const derived = new Set<CapabilityKey>(['dashboard']);
    for (const module of modules) {
      for (const capability of module.capabilities) {
        if (isValidCapabilityKey(capability)) {
          derived.add(capability);
        }
      }
    }

    const granted = this.applyAllowList(derived, enabledCapabilities);

    return {
      granted,
      can: (capability) => granted.includes(capability),
    };
  }

  /** Applies the optional allow-list after derivation, keeping dashboard always. */
  private applyAllowList(
    derived: ReadonlySet<CapabilityKey>,
    enabledCapabilities?: readonly string[] | null,
  ): CapabilityKey[] {
    if (enabledCapabilities === undefined || enabledCapabilities === null) {
      return Array.from(derived).sort(compareCapability);
    }

    const allowed = new Set<string>(enabledCapabilities);
    return Array.from(derived)
      .filter((capability) => capability === 'dashboard' || allowed.has(capability))
      .sort(compareCapability);
  }
}

function compareCapability(a: CapabilityKey, b: CapabilityKey): number {
  return a.localeCompare(b);
}