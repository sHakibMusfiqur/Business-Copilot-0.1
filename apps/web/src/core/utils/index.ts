// ── Assertions ─────────────────────────────────────────────────────────────
export * from './assert/index';

// ── Guards ─────────────────────────────────────────────────────────────────
export * from './guards/index';

// ── Collections: arrays ────────────────────────────────────────────────────
export {
  first,
  last,
  compact,
  unique,
  uniqueBy,
  partition,
  chunk,
  groupBy,
  flatten,
  flattenDeep,
  range,
  sum as sumArray,
  average,
  max as maxOf,
  min as minOf,
  sortBy,
  remove as removeItem,
  difference as differenceArrays,
  intersection as intersectionArrays,
  contains as containsItem,
} from './collections/arrays';

// ── Collections: maps ──────────────────────────────────────────────────────
export {
  getOrDefault,
  getOrCreate,
  createMap,
  mapValues as mapMapValues,
  filter as filterMap,
  entries as entriesMap,
  keys as keysMap,
  values as valuesMap,
  invert as invertMap,
  merge as mergeMaps,
  reduce as reduceMap,
} from './collections/maps';

// ── Collections: sets ──────────────────────────────────────────────────────
export {
  addAll,
  union,
  intersect,
  difference as differenceSets,
  isSubset,
  intersects,
  containsAll,
  toArray as setToArray,
  filter as filterSet,
  map as mapSet,
} from './collections/sets';

// ── Objects (clone / merge / equality) ─────────────────────────────────────
export {
  clone,
  shallowEqual,
  deepEqual,
  deepMerge,
  merge as mergeObjects,
  pick,
  omit,
  objectKeys,
  size as objectSize,
  isEmptyObject,
  mapValues as mapObjectValues,
} from './objects/index';

// ── Strings ────────────────────────────────────────────────────────────────
export {
  capitalize,
  uncapitalize,
  camelCase,
  pascalCase,
  kebabCase,
  snakeCase,
  constantCase,
  truncate,
  escapeHtml,
  reverse,
  padStart as padString,
  startsWithAny,
  endsWithAny,
  countOccurrences,
  trim,
  isBlank as isBlankString,
} from './strings/index';

// ── Numbers ────────────────────────────────────────────────────────────────
export {
  clamp,
  round,
  floor,
  ceil,
  randomInt,
  percentage,
  formatNumber,
  formatBytes,
  inRange as inNumberRange,
  mod,
  diff,
} from './numbers/index';

// ── Dates ──────────────────────────────────────────────────────────────────
export {
  isValidDate,
  toISO,
  toUnixSeconds,
  fromUnixSeconds,
  startOfDay,
  endOfDay,
  addDays,
  addMonths,
  daysInMonth,
  diffInDays,
  isBefore,
  isAfter,
  isSameDay,
  format as formatDate,
  diffInDaysAbs,
} from './dates/index';

// ── Async ──────────────────────────────────────────────────────────────────
export {
  sleep,
  withTimeout,
  retry,
  debounce,
  throttle,
  mapSeries,
  mapParallel,
  fallback,
  deferred,
} from './async/index';
export type { RetryOptions, Deferred } from './async/index';

// ── Result ─────────────────────────────────────────────────────────────────
export {
  ok,
  err,
  isOk,
  isErr,
  tryCatch,
  tryCatchAsync,
  unwrap as unwrapResult,
  unwrapOr as unwrapResultOr,
  map as mapResult,
  mapErr,
  flatMap as flatMapResult,
  all as allResults,
  fromNullable as resultFromNullable,
} from './result/index';
export type { Result, Ok, Err } from './result/index';

// ── Option ─────────────────────────────────────────────────────────────────
export {
  some,
  none,
  isSome,
  isNone,
  fromNullable as optionFromNullable,
  unwrapOr as unwrapOption,
  map as mapOption,
  flatMap as flatMapOption,
  compact as compactOptions,
  firstSome,
  toResult,
} from './option/index';
export type { Option, Some, None } from './option/index';

// ── Memo ──────────────────────────────────────────────────────────────────
export {
  memoize,
  memoizeBy,
  memoizeByArgs,
  memoizeAsync,
  once,
  memoizeTtl,
} from './memo/index';

// ── Tree ──────────────────────────────────────────────────────────────────
export {
  node as treeNode,
  flatten as flattenTree,
  filter as filterTree,
  map as mapTree,
  find as findInTree,
  leaves as leavesOf,
  depth as treeDepth,
  size as treeSize,
  pathTo as treePathTo,
} from './tree/index';
export type { TreeNode } from './tree/index';

// ── Graph ─────────────────────────────────────────────────────────────────
export {
  bfs,
  dfs as dfsGraph,
  topologicalSort,
  sortByDependencies,
  findCycle as findCycleIn,
  hasCycle as graphHasCycle,
  reachable,
} from './graph/index';
export type { Graph } from './graph/index';

// ── Path ──────────────────────────────────────────────────────────────────
export {
  parsePath,
  get as getPath,
  has as hasPath,
  set as setPath,
  entries as flattenPath,
  unflatten as unflattenPath,
} from './path/index';

// ── Hash ──────────────────────────────────────────────────────────────────
export {
  hashString,
  hashHex,
  stableSerialize,
  hashObject,
  hashCode,
} from './hash/index';

// ── UUID / random ─────────────────────────────────────────────────────────
export {
  uuidv4,
  uuid,
  shortId,
  random as randomNumber,
} from './uuid/index';