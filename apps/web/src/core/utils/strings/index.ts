/** Split a string into words by case boundaries, spaces and separators. */
function words(value: string): string[] {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

/** Capitalize the first character. */
export function capitalize(value: string): string {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}

/** Lowercase the first character. */
export function uncapitalize(value: string): string {
  return value.length === 0 ? value : value[0].toLowerCase() + value.slice(1);
}

/** camelCase: `hello world` -> `helloWorld`. */
export function camelCase(value: string): string {
  const w = words(value.toLowerCase());
  return w.length === 0
    ? ''
    : w[0] + w.slice(1).map(capitalize).join('');
}

/** pascalCase: `hello world` -> `HelloWorld`. */
export function pascalCase(value: string): string {
  return words(value).map((w) => capitalize(w.toLowerCase())).join('');
}

/** kebabCase: `hello world` -> `hello-world`. */
export function kebabCase(value: string): string {
  return words(value.toLowerCase()).join('-');
}

/** snakeCase: `hello world` -> `hello_world`. */
export function snakeCase(value: string): string {
  return words(value.toLowerCase()).join('_');
}

/** constantCase: `hello world` -> `HELLO_WORLD`. */
export function constantCase(value: string): string {
  return words(value.toUpperCase()).join('_');
}

/** Truncate to `max` chars, appending a suffix when clipped. */
export function truncate(value: string, max: number, suffix = '…'): string {
  if (value.length <= max) return value;
  return value.slice(0, Math.max(0, max - suffix.length)) + suffix;
}

/** Escape HTML special characters. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Reverse a string. */
export function reverse(value: string): string {
  return Array.from(value).reverse().join('');
}

/** Pad to a target length on the left with `char`. */
export function padStart(value: string | number, length: number, char = '0'): string {
  return String(value).padStart(length, char);
}

/** Does the string start with any of the prefixes? */
export function startsWithAny(value: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => value.startsWith(prefix));
}

/** Does the string end with any of the suffixes? */
export function endsWithAny(value: string, suffixes: readonly string[]): boolean {
  return suffixes.some((suffix) => value.endsWith(suffix));
}

/** Count non-overlapping occurrences of a substring. */
export function countOccurrences(value: string, search: string): number {
  if (search.length === 0) return 0;
  let count = 0;
  let position = 0;
  for (;;) {
    const index = value.indexOf(search, position);
    if (index === -1) break;
    count++;
    position = index + search.length;
  }
  return count;
}

/** Remove whitespace from both ends (thin wrapper for clarity). */
export function trim(value: string): string {
  return value.trim();
}

/** Is the string blank (empty or only whitespace)? */
export function isBlank(value: string): boolean {
  return value.trim().length === 0;
}