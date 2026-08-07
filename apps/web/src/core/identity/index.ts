/** Enterprise Platform Identity Engine — public surface. */
export { IdentityEngine, identityEngine } from './registry';
export { IDENTITY_CATALOG } from './catalog';
export {
  IDENTITY_ENGINE_VERSION,
  IDENTITY_KINDS,
  IDENTITY_NAMESPACES,
  isNamespace,
  isValidId,
  qualify,
  IdentityError,
} from './metadata';
export { resolveCatalog } from './resolver';
export { buildSnapshot } from './snapshot';
export type {
  IdentityKind,
  IdentityNamespace,
  IdentityMetadata,
  IdentityEntry,
  IdentityInput,
  IdentitySnapshot,
} from './types';