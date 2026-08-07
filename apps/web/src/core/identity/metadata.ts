import { DEFAULT_NAMESPACE_BY_KIND } from './types';
import type { IdentityInput, IdentityKind, IdentityNamespace } from './types';

/** Current identity engine schema version. */
export const IDENTITY_ENGINE_VERSION = '1.0.0';

/** All supported identity kinds. */
export const IDENTITY_KINDS: readonly IdentityKind[] = [
  'engine',
  'service',
  'module',
  'feature',
  'capability',
  'permission',
  'config',
  'token',
  'logger',
  'error',
  'plugin',
  'workflow',
  'automation',
  'notification',
  'integration',
  'ai',
  'scheduler',
  'storage',
  'search',
  'route',
  'widget',
  'command',
  'dashboard',
];

/** All supported identity namespaces. */
export const IDENTITY_NAMESPACES: readonly IdentityNamespace[] = [
  'platform.engine',
  'platform.service',
  'platform.module',
  'platform.feature',
  'platform.capability',
  'platform.permission',
  'platform.config',
  'platform.token',
  'platform.logger',
  'platform.error',
  'platform.plugin',
  'platform.workflow',
  'platform.automation',
  'platform.notification',
  'platform.integration',
  'platform.ai',
  'platform.scheduler',
  'platform.storage',
  'platform.search',
  'platform.route',
  'platform.widget',
  'platform.command',
  'platform.dashboard',
];

/** Whether a string is a recognized namespace. */
export function isNamespace(value: string): value is IdentityNamespace {
  return (IDENTITY_NAMESPACES as readonly string[]).includes(value);
}

/** Validate an id's shape: `namespace.key`, dotted segments (case-insensitive). */
export function isValidId(id: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9]*(?:[._-][a-zA-Z0-9]+)*$/.test(id) && id.includes('.');
}

/** Validate a single local segment (id or ref) — dot/hyphen/underscore segments. */
export function isValidSegment(segment: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9]*(?:[._-][a-zA-Z0-9]+)*$/.test(segment);
}

/** Resolve the effective (dotted) namespace for an identity input. */
export function effectiveNamespace(
  kind: IdentityKind,
  namespace?: IdentityNamespace,
): IdentityNamespace {
  if (namespace) {
    if (!isNamespace(namespace)) {
      throw new IdentityError(`Invalid identity namespace: "${namespace}".`);
    }
    return namespace;
  }
  return DEFAULT_NAMESPACE_BY_KIND[kind];
}

/** Build the fully-qualified id for an identity input. */
export function qualify(id: string, kind: IdentityKind, namespace?: IdentityNamespace): string {
  return `${effectiveNamespace(kind, namespace)}.${id}`;
}

/** Thrown when identity registration violates uniqueness/namespace rules. */
export class IdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdentityError';
  }
}

/** Validate input, throwing IdentityError on invalid ids/refs. */
export function assertValidIdentity(input: IdentityInput): void {
  if (!isValidSegment(input.id)) {
    throw new IdentityError(`Invalid identity id: "${input.id}". Must be dotted segments.`);
  }
  // Validate the namespace when supplied; default otherwise.
  if (input.namespace !== undefined && !isNamespace(input.namespace)) {
    throw new IdentityError(`Invalid identity namespace: "${input.namespace}".`);
  }
  if (!isValidSegment(input.ref)) {
    throw new IdentityError(`Identity "${input.id}" must carry a non-empty lowercase ref.`);
  }
}