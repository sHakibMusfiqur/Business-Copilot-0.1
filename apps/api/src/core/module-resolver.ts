import type {
  CapabilityKey,
  IndustryKey,
  ModuleManifest,
  RoleKey,
} from '@bc/core';


/**
 * A lazily-evaluated source of module manifests. Used by Nest DI to bind a
 * `ModuleResolver` to the live kernel `ModuleRegistry` so it always reflects
 * the currently registered manifests (which are populated during bootstrap,
 * after providers are constructed). Static callers pass an array directly.
 */
export interface ManifestSource {
  list(): readonly ModuleManifest[];
}


function isManifestArray(
  manifests: readonly ModuleManifest[] | ManifestSource,
): manifests is readonly ModuleManifest[] {
  return Array.isArray(manifests);
}


export interface ModuleResolverContext {
  role?: RoleKey | null;
  industry?: IndustryKey | null;
  permissions?: string[];
  capabilities?: CapabilityKey[];
  /** When provided, only modules in this allow-list are available. */
  enabledModules?: string[] | null;
}


function visibilityAllows(
  manifest: ModuleManifest,
  context: ModuleResolverContext,
): boolean {
  const visibility = manifest.visibility;
  if (visibility?.always) return true;

  if (visibility?.roles && visibility.roles.length > 0) {
    if (!context.role || !visibility.roles.includes(context.role)) return false;
  }

  const industryRestrictions = visibility?.industries ?? manifest.industries;
  if (industryRestrictions && industryRestrictions.length > 0) {
    if (
      !context.industry ||
      !industryRestrictions.includes(context.industry)
    ) {
      return false;
    }
  }

  return true;
}


export class ModuleResolver {
  private readonly manifests: readonly ModuleManifest[] | ManifestSource;

  constructor(manifests: readonly ModuleManifest[] | ManifestSource) {
    this.manifests = manifests;
  }

  /** Lazily resolves the current set of manifests from the configured source. */
  private get manifestList(): readonly ModuleManifest[] {
    return isManifestArray(this.manifests)
      ? this.manifests
      : this.manifests.list();
  }

  resolve(context: ModuleResolverContext): ModuleManifest[] {
    return this.manifestList
      .filter((manifest) => this.isAvailable(manifest, context))
      .sort((a, b) => a.id.localeCompare(b.id));
  }


  isEnabled(
    moduleId: string,
    context: ModuleResolverContext,
  ): boolean {
    const manifest = this.manifestList.find((m) => m.id === moduleId);
    return manifest !== undefined && this.isAvailable(manifest, context);
  }

  /** Core availability predicate shared by resolve/isEnabled. */
  private isAvailable(
    manifest: ModuleManifest,
    context: ModuleResolverContext,
  ): boolean {
    const capabilities = context.capabilities ?? [];
    if (!manifest.capabilities.every((cap) => capabilities.includes(cap))) {
      return false;
    }

    const permissions = context.permissions ?? [];
    if (!manifest.permissions.every((perm) => permissions.includes(perm))) {
      return false;
    }

    if (!visibilityAllows(manifest, context)) {
      return false;
    }

    const enabledModules = context.enabledModules;
    if (enabledModules && !enabledModules.includes(manifest.id)) {
      return false;
    }

    return true;
  }
}