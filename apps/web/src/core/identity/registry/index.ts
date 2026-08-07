import { IDENTITY_CATALOG } from '../catalog';
import {
  IDENTITY_ENGINE_VERSION,
  IDENTITY_KINDS,
  IDENTITY_NAMESPACES,
  isNamespace,
  isValidId,
  IdentityError,
} from '../metadata';
import { resolveCatalog, findByRef } from '../resolver';
import { buildSnapshot } from '../snapshot';
import type {
  IdentityEntry,
  IdentityInput,
  IdentityKind,
  IdentitySnapshot,
} from '../types';

/**
 * Enterprise Platform Identity Engine — the canonical identity registry of the
 * Business OS.
 *
 * Every engine must reference an identity from here; no engine owns its own
 * string identifiers. Identities are canonical, immutable, globally unique and
 * strongly typed. The catalog is derived from the existing engines (modules,
 * features, capabilities, config, tokens, errors, logger, services) so nothing
 * is duplicated — this engine is the lookup layer on top of them.
 */
export class IdentityEngine {
  readonly version = IDENTITY_ENGINE_VERSION;
  private readonly byId = new Map<string, IdentityEntry>();
  private readonly byRef = new Map<string, IdentityEntry>();

  constructor(entries: readonly IdentityInput[] = IDENTITY_CATALOG) {
    const resolved = resolveCatalog(entries);
    for (const entry of resolved) {
      this.byId.set(entry.id, entry);
      this.byRef.set(`${entry.kind}:${entry.ref}`, entry);
    }
  }

  // ── Registration ─────────────────────────────────────────────────────────

  /** Register a new identity. Throws on duplicate or invalid input. */
  register(input: IdentityInput): void {
    const [entry] = resolveCatalog([input]);
    if (this.byId.has(entry.id)) {
      throw new IdentityError(`Duplicate identity id: "${entry.id}".`);
    }
    if (this.byRef.has(`${entry.kind}:${entry.ref}`)) {
      throw new IdentityError(
        `Duplicate ref "${entry.ref}" for kind "${entry.kind}".`,
      );
    }
    this.byId.set(entry.id, entry);
    this.byRef.set(`${entry.kind}:${entry.ref}`, entry);
  }

  // ── Presence / resolution ────────────────────────────────────────────────

  /** Whether a fully-qualified id is registered. */
  has(id: string): boolean {
    return this.byId.has(id);
  }

  /** Resolve a fully-qualified id to its entry. */
  resolve(id: string): IdentityEntry | undefined {
    return this.byId.get(id);
  }

  /** Resolve an entry by (kind, ref) — e.g. resolve('module', 'dashboard'). */
  resolveRef(kind: IdentityKind, ref: string): IdentityEntry | undefined {
    return findByRef(this.byRef, kind, ref);
  }

  /** Describe an identity by full id; throws when unknown. */
  describe(id: string): IdentityEntry {
    const entry = this.byId.get(id);
    if (!entry) {
      throw new IdentityError(`Unknown identity: "${id}".`);
    }
    return entry;
  }

  // ── Typed accessors ──────────────────────────────────────────────────────

  /** Is the id a canonical engine identity? */
  isEngine(id: string): boolean {
    return this.byId.get(id)?.kind === 'engine';
  }
  isService(id: string): boolean {
    return this.byId.get(id)?.kind === 'service';
  }
  isModule(id: string): boolean {
    return this.byId.get(id)?.kind === 'module';
  }
  isFeature(id: string): boolean {
    return this.byId.get(id)?.kind === 'feature';
  }

  /** All identities of a kind. */
  of(kind: IdentityKind): readonly IdentityEntry[] {
    return [...this.byId.values()].filter((entry) => entry.kind === kind);
  }
  engine(): readonly IdentityEntry[] {
    return this.of('engine');
  }
  service(): readonly IdentityEntry[] {
    return this.of('service');
  }
  module(): readonly IdentityEntry[] {
    return this.of('module');
  }
  feature(): readonly IdentityEntry[] {
    return this.of('feature');
  }
  permission(): readonly IdentityEntry[] {
    return this.of('permission');
  }
  capability(): readonly IdentityEntry[] {
    return this.of('capability');
  }
  token(): readonly IdentityEntry[] {
    return this.of('token');
  }
  config(): readonly IdentityEntry[] {
    return this.of('config');
  }
  logger(): readonly IdentityEntry[] {
    return this.of('logger');
  }
  error(): readonly IdentityEntry[] {
    return this.of('error');
  }
  plugin(): readonly IdentityEntry[] {
    return this.of('plugin');
  }
  workflow(): readonly IdentityEntry[] {
    return this.of('workflow');
  }
  automation(): readonly IdentityEntry[] {
    return this.of('automation');
  }
  notification(): readonly IdentityEntry[] {
    return this.of('notification');
  }
  integration(): readonly IdentityEntry[] {
    return this.of('integration');
  }
  ai(): readonly IdentityEntry[] {
    return this.of('ai');
  }
  scheduler(): readonly IdentityEntry[] {
    return this.of('scheduler');
  }
  storage(): readonly IdentityEntry[] {
    return this.of('storage');
  }
  search(): readonly IdentityEntry[] {
    return this.of('search');
  }
  route(): readonly IdentityEntry[] {
    return this.of('route');
  }
  widget(): readonly IdentityEntry[] {
    return this.of('widget');
  }
  command(): readonly IdentityEntry[] {
    return this.of('command');
  }
  dashboard(): readonly IdentityEntry[] {
    return this.of('dashboard');
  }

  // ── Namespaces / enumeration ─────────────────────────────────────────────

  /** All identities in a namespace. */
  byNamespace(namespace: string): readonly IdentityEntry[] {
    return [...this.byId.values()].filter((entry) => entry.namespace === namespace);
  }

  namespaces(): readonly string[] {
    return IDENTITY_NAMESPACES;
  }

  kinds(): readonly IdentityKind[] {
    return IDENTITY_KINDS;
  }

  keys(): string[] {
    return [...this.byId.keys()];
  }

  list(): readonly IdentityEntry[] {
    return [...this.byId.values()];
  }

  /** Immutable snapshot of the entire identity registry. */
  snapshot(): IdentitySnapshot {
    return buildSnapshot(this.list());
  }

  /** Total registered identities. */
  get size(): number {
    return this.byId.size;
  }
}

/** Utility predicates for external validation. */
export { isNamespace, isValidId };

/** Default identity engine instance booted over the derived catalog. */
export const identityEngine: IdentityEngine = new IdentityEngine();

export type { IdentityKind };