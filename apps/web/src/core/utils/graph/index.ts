/** A directed graph of dependencies: node -> its dependencies. */
export type Graph<V> = ReadonlyMap<V, readonly V[]>;

/** Breadth-first traversal from a start node. */
export function bfs<V>(graph: Graph<V>, start: V): V[] {
  const visited = new Set<V>([start]);
  const queue: V[] = [start];
  const out: V[] = [];
  while (queue.length > 0) {
    const current = queue.shift() as V;
    out.push(current);
    for (const next of graph.get(current) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return out;
}

/** Depth-first traversal (pre-order) from a start node. */
export function dfs<V>(graph: Graph<V>, start: V): V[] {
  const visited = new Set<V>();
  const out: V[] = [];
  const walk = (current: V): void => {
    if (visited.has(current)) return;
    visited.add(current);
    out.push(current);
    for (const next of graph.get(current) ?? []) walk(next);
  };
  walk(start);
  return out;
}

/** Topological sort (dependencies first) of all nodes; throws on a cycle. */
export function topologicalSort<V>(graph: Graph<V>): V[] {
  const state = new Map<V, 'visiting' | 'done'>();
  const out: V[] = [];

  const visit = (node: V): void => {
    const marker = state.get(node);
    if (marker === 'done') return;
    if (marker === 'visiting') {
      throw new Error(`Graph: cycle detected at node "${String(node)}".`);
    }
    state.set(node, 'visiting');
    for (const dep of graph.get(node) ?? []) visit(dep);
    state.set(node, 'done');
    out.push(node);
  };

  for (const node of graph.keys()) visit(node);
  return out;
}

/** Order a subset of nodes by their dependencies (unknown deps ignored). */
export function sortByDependencies<V>(graph: Graph<V>, nodes: readonly V[]): V[] {
  const relevant = new Set<V>(nodes);
  const filtered = new Map<V, readonly V[]>();
  for (const node of nodes) {
    const deps = (graph.get(node) ?? []).filter((dep) => relevant.has(dep));
    filtered.set(node, deps);
  }
  return topologicalSort(filtered);
}

/** Detect whether the graph contains any cycle; returns the cycle when found. */
export function findCycle<V>(graph: Graph<V>): V[] | undefined {
  const state = new Map<V, 'visiting' | 'done'>();
  const stack: V[] = [];

  const visit = (node: V): V[] | undefined => {
    const marker = state.get(node);
    if (marker === 'done') return undefined;
    if (marker === 'visiting') {
      const start = stack.indexOf(node);
      return [...stack.slice(start), node];
    }
    state.set(node, 'visiting');
    stack.push(node);
    for (const dep of graph.get(node) ?? []) {
      const cycle = visit(dep);
      if (cycle) return cycle;
    }
    stack.pop();
    state.set(node, 'done');
    return undefined;
  };

  for (const node of graph.keys()) {
    const cycle = visit(node);
    if (cycle) return cycle;
  }
  return undefined;
}

/** Does the graph contain a cycle? */
export function hasCycle<V>(graph: Graph<V>): boolean {
  return findCycle(graph) !== undefined;
}

/** All nodes reachable from a set of roots (transitive closure). */
export function reachable<V>(graph: Graph<V>, roots: readonly V[]): Set<V> {
  const seen = new Set<V>();
  const stack = [...roots];
  while (stack.length > 0) {
    const current = stack.pop() as V;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const next of graph.get(current) ?? []) {
      if (!seen.has(next)) stack.push(next);
    }
  }
  return seen;
}