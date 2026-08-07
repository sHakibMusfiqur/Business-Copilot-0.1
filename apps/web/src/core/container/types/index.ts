/** Lifetime strategy applied when a token is resolved. */
export type Lifetime = 'singleton' | 'scoped' | 'transient';

/** Kind of provider registered for a token. */
export type ProviderKind = 'class' | 'factory' | 'value';

/** Stable versions of the container schema. */
export const CONTAINER_ENGINE_VERSION = '1.0.0';


export class ContainerToken<T = unknown> {
  /** Nominal brand — distinguishes tokens typed with different T. */
  private readonly _type!: T;
  readonly id: string;
  readonly name: string;
  constructor(id: string, name?: string) {
    this.id = id;
    this.name = name ?? id;
  }
  toString(): string {
    return `ContainerToken(${this.id})`;
  }
}

/** A token reference accepts a nominal token or a plain id string. */
export type Token<T = unknown> = ContainerToken<T> | string;

/** Normalize any token reference to its canonical string id. */
export function tokenId(token: Token): string {
  return typeof token === 'string' ? token : token.id;
}


export interface ClassProvider<T> {
  kind: 'class';
  token: ContainerToken<T>;
  useClass: new (...deps: unknown[]) => T;
  deps?: readonly Token[];
  lifetime?: Lifetime;
}

/** Factory provider — invokes `useFactory` against the container to build T. */
export interface FactoryProvider<T> {
  kind: 'factory';
  token: ContainerToken<T>;
  useFactory: (container: ContainerLike) => T;
  lifetime?: Lifetime;
}

/** Value provider — a prebuilt instance shared as a singleton. */
export interface ValueProvider<T> {
  kind: 'value';
  token: ContainerToken<T>;
  useValue: T;
}

/** Union of accepted provider declarations. */
export type Provider<T = unknown> = ClassProvider<T> | FactoryProvider<T> | ValueProvider<T>;

/** Minimal container surface a factory can resolve against. */
export interface ContainerLike {
  resolve<T>(token: Token<T>): T;
  has(token: Token): boolean;
}

/** Static identity of a registered provider (no live instance). */
export interface ContainerDescriptor {
  token: string;
  provider: ProviderKind;
  lifetime: Lifetime;
  name: string;
}

/** Entry in a container snapshot. */
export interface ContainerSnapshotEntry {
  token: string;
  provider: ProviderKind;
  lifetime: Lifetime;
  name: string;
  instantiated: boolean;
}

/** Immutable container snapshot at a point in time. */
export interface ContainerSnapshot {
  version: string;
  takenAt: string;
  registrySize: number;
  instantiatedCount: number;
  entries: readonly ContainerSnapshotEntry[];
}

/** Options accepted by the container constructor. */
export interface ContainerOptions {
  /** Human-readable container name. */
  name?: string;
}

/** Base class for all container errors. */
export class ContainerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContainerError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** A token was requested but never registered. */
export class UnregisteredTokenError extends ContainerError {
  constructor(token: string) {
    super(`Container: token "${token}" is not registered.`);
    this.name = 'UnregisteredTokenError';
  }
}

/** Two providers were registered for the same token. */
export class DuplicateTokenError extends ContainerError {
  constructor(token: string) {
    super(`Container: token "${token}" is already registered.`);
    this.name = 'DuplicateTokenError';
  }
}

/** A dependency cycle was detected during resolution. */
export class CircularDependencyError extends ContainerError {
  readonly cycle: readonly string[];
  constructor(cycle: readonly string[]) {
    super(
      `Container: circular dependency detected: ${cycle.join(' -> ')} -> ${cycle[0]}.`,
    );
    this.name = 'CircularDependencyError';
    this.cycle = cycle;
  }
}