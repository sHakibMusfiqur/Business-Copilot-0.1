import type { FeatureDefinition, ResolvedFeature } from '../types';

/** Error thrown when feature dependency validation fails. */
export class FeatureDependencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeatureDependencyError';
  }
}

/** Build a dependency graph (map of feature id -> its dependency ids). */
export function buildDependencyGraph(
  features: readonly FeatureDefinition[],
): ReadonlyMap<string, readonly string[]> {
  const graph = new Map<string, readonly string[]>();
  for (const feature of features) {
    graph.set(feature.id, feature.dependencies ?? []);
  }
  return graph;
}

/** Detect unknown dependency references across the catalog. */
export function validateDependencies(
  features: readonly FeatureDefinition[],
): string[] {
  const ids = new Set(features.map((feature) => feature.id));
  const problems: string[] = [];
  for (const feature of features) {
    for (const dependency of feature.dependencies ?? []) {
      if (!ids.has(dependency)) {
        problems.push(`Feature "${feature.id}" depends on unknown feature "${dependency}".`);
      }
    }
  }
  return problems;
}

/** Topologically order the dependencies of a single feature (cycle-safe). */
export function dependencyChainOf(
  id: string,
  graph: ReadonlyMap<string, readonly string[]>,
  visited: Set<string>,
  stack: string[],
): string[] {
  if (stack.includes(id)) {
    throw new FeatureDependencyError(`Cyclic feature dependency: ${[...stack, id].join(' -> ')}`);
  }
  if (visited.has(id)) {
    return [];
  }
  visited.add(id);
  stack.push(id);
  const chain: string[] = [];
  for (const dependency of graph.get(id) ?? []) {
    chain.push(...dependencyChainOf(dependency, graph, visited, stack));
    chain.push(dependency);
  }
  stack.pop();
  return chain;
}

/** Resolve the full catalog into ResolvedFeature entries. */
export function resolveFeatures(
  features: readonly FeatureDefinition[],
): ResolvedFeature[] {
  const problems = validateDependencies(features);
  if (problems.length > 0) {
    throw new FeatureDependencyError(problems.join(' '));
  }
  const graph = buildDependencyGraph(features);
  return features.map((feature) => ({
    ...feature,
    dependencyChain: [...new Set(dependencyChainOf(feature.id, graph, new Set(), []))],
  }));
}