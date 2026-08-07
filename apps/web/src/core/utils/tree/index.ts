/** A generic node: a value plus ordered children. */
export interface TreeNode<T> {
  value: T;
  children: readonly TreeNode<T>[];
}

/** Build a tree node from a value and children. */
export function node<T>(value: T, children: readonly TreeNode<T>[] = []): TreeNode<T> {
  return { value, children };
}

/** Depth-first traversal (pre-order). Returns the node when found. */
export function find<T>(
  root: TreeNode<T>,
  predicate: (value: T, depth: number) => boolean,
): T | undefined {
  const stack: Array<{ node: TreeNode<T>; depth: number }> = [{ node: root, depth: 0 }];
  while (stack.length > 0) {
    const { node: current, depth } = stack.pop() as { node: TreeNode<T>; depth: number };
    if (predicate(current.value, depth)) return current.value;
    for (let i = current.children.length - 1; i >= 0; i--) {
      stack.push({ node: current.children[i], depth: depth + 1 });
    }
  }
  return undefined;
}

/** Flatten the whole tree into a list (pre-order). */
export function flatten<T>(root: TreeNode<T>): T[] {
  const out: T[] = [];
  const walk = (current: TreeNode<T>): void => {
    out.push(current.value);
    for (const child of current.children) walk(child);
  };
  walk(root);
  return out;
}

/** Map every value, preserving structure. */
export function map<T, R>(root: TreeNode<T>, fn: (value: T, depth: number) => R): TreeNode<R> {
  const walk = (current: TreeNode<T>, depth: number): TreeNode<R> =>
    node(
      fn(current.value, depth),
      current.children.map((child) => walk(child, depth + 1)),
    );
  return walk(root, 0);
}

/** Filter subtrees where a predicate holds for the node. */
export function filter<T>(
  root: TreeNode<T>,
  predicate: (value: T, depth: number) => boolean,
): TreeNode<T> | undefined {
  const walk = (current: TreeNode<T>, depth: number): TreeNode<T> | undefined => {
    const kept = predicate(current.value, depth);
    const children: TreeNode<T>[] = [];
    for (const child of current.children) {
      const mapped = walk(child, depth + 1);
      if (mapped) children.push(mapped);
    }
    if (!kept && children.length === 0) return undefined;
    return node(current.value, children);
  };
  return walk(root, 0);
}

/** Leaf values (nodes without children). */
export function leaves<T>(root: TreeNode<T>): T[] {
  const out: T[] = [];
  const walk = (current: TreeNode<T>): void => {
    if (current.children.length === 0) {
      out.push(current.value);
      return;
    }
    for (const child of current.children) walk(child);
  };
  walk(root);
  return out;
}

/** Maximum depth (root = 0). */
export function depth<T>(root: TreeNode<T>): number {
  let deepest = 0;
  const walk = (current: TreeNode<T>, level: number): void => {
    if (level > deepest) deepest = level;
    for (const child of current.children) walk(child, level + 1);
  };
  walk(root, 0);
  return deepest;
}

/** Count of all nodes. */
export function size<T>(root: TreeNode<T>): number {
  return flatten(root).length;
}

/** Collect the path of values from the root to a matching node, if any. */
export function pathTo<T>(
  root: TreeNode<T>,
  predicate: (value: T) => boolean,
): T[] | undefined {
  const walk = (current: TreeNode<T>, path: T[]): T[] | undefined => {
    const next = [...path, current.value];
    if (predicate(current.value)) return next;
    for (const child of current.children) {
      const found = walk(child, next);
      if (found) return found;
    }
    return undefined;
  };
  return walk(root, []);
}