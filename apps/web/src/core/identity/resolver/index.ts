import {
  assertValidIdentity,
  effectiveNamespace,
  isNamespace,
  isValidId,
  qualify,
  IdentityError,
} from '../metadata';
import type { IdentityEntry, IdentityInput, IdentityKind, IdentityNamespace } from '../types';

export function resolveCatalog(
  entries: readonly IdentityInput[],
): IdentityEntry[] {
  const seenIds = new Set<string>();
  const seenRefs = new Set<string>();
  const resolved: IdentityEntry[] = [];

  for (const input of entries) {
    assertValidIdentity(input);
    const namespace = effectiveNamespace(input.kind, input.namespace);
    const idKey = `${namespace}.${input.id}`;
    const refKey = `${namespace}:${input.ref}`;

    if (seenIds.has(idKey)) {
      throw new IdentityError(`Duplicate identity id: "${idKey}".`);
    }
    if (seenRefs.has(refKey)) {
      throw new IdentityError(
        `Duplicate ref "${input.ref}" within namespace "${namespace}".`,
      );
    }

    seenIds.add(idKey);
    seenRefs.add(refKey);
    resolved.push({
      ...input,
      id: idKey,
      namespace,
    });
  }

  return resolved;
}

/** Index a resolved entry list for lookup by id. */
export function indexByIdentities(
  entries: readonly IdentityEntry[],
): ReadonlyMap<string, IdentityEntry> {
  return new Map(entries.map((entry) => [entry.id, entry]));
}

/** Index entries by (kind, ref) for typed resolution. */
export function indexByRef(
  entries: readonly IdentityEntry[],
): ReadonlyMap<string, IdentityEntry> {
  const map = new Map<string, IdentityEntry>();
  for (const entry of entries) {
    map.set(`${entry.kind}:${entry.ref}`, entry);
  }
  return map;
}

/** Lookup an entry by ref within a kind. */
export function findByRef(
  byRef: ReadonlyMap<string, IdentityEntry>,
  kind: IdentityKind,
  ref: string,
): IdentityEntry | undefined {
  return byRef.get(`${kind}:${ref}`);
}

export { isNamespace, isValidId, qualify, IdentityError };
export type { IdentityNamespace };