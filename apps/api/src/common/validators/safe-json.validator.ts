import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';


export const SAFE_JSON_MAX_DEPTH = 10;
export const SAFE_JSON_MAX_BYTES = 65536;

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isSafeJsonValue(value: unknown, depth: number): boolean {
  if (value === null) return true;
  if (typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  if (depth > SAFE_JSON_MAX_DEPTH) return false;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!isSafeJsonValue(item, depth + 1)) return false;
    }
    return true;
  }
  const prototype = Object.getPrototypeOf(value) as object | null;
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEYS.has(key)) return false;
    if (!isSafeJsonValue((value as Record<string, unknown>)[key], depth + 1)) {
      return false;
    }
  }
  return true;
}

export function isSafeJson(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as object | null;
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }
  if (!isSafeJsonValue(value, 1)) return false;
  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized !== 'string') return false;
    return Buffer.byteLength(serialized, 'utf8') <= SAFE_JSON_MAX_BYTES;
  } catch {
    return false;
  }
}

export function IsSafeJson(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isSafeJson',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: unknown) => isSafeJson(value),
        defaultMessage: (args: ValidationArguments) =>
          `${args.property} must be a safe JSON object (plain object, JSON-representable values, no dangerous keys, within depth and size limits)`,
      },
    });
  };
}
