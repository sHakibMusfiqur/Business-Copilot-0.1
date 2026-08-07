import { CONFIG_VALUE_TYPES } from './constants';
import { ConfigValidationError } from './errors';
import type {
  ConfigDefinition,
  ConfigScope,
  ConfigValue,
  ConfigValueType,
} from './types';

/** Scopes that may hold an `environment`-sourced value. */
const ENVIRONMENT_SCOPES: readonly ConfigScope[] = ['platform', 'environment', 'organization', 'workspace'];

/** Validate a value against its declared schema type. */
export function assertValueType(
  value: ConfigValue,
  type: ConfigValueType | undefined,
  id: string,
): ConfigValue {
  if (value === null) {
    return value;
  }
  if (!type) {
    return value;
  }
  const valid =
    type === 'string'
      ? typeof value === 'string'
      : type === 'number'
        ? typeof value === 'number'
        : type === 'boolean'
          ? typeof value === 'boolean'
          : false;
  if (!valid) {
    throw new ConfigValidationError(
      id,
      `Expected value of type "${type}", received ${describeValue(value)}.`,
    );
  }
  return value;
}

/** Run the definition's custom validator (if any) and reject on failure. */
export function assertValidator(
  value: ConfigValue,
  definition: ConfigDefinition,
): void {
  if (definition.validator && !definition.validator(value)) {
    throw new ConfigValidationError(definition.id, 'Custom validator rejected the value.');
  }
}

/** Whether a scope is eligible to carry an environment-sourced value. */
export function isEnvironmentScope(scope: ConfigScope): boolean {
  return ENVIRONMENT_SCOPES.includes(scope);
}

function describeValue(value: ConfigValue): string {
  if (value === null) {
    return 'null';
  }
  return typeof value;
}

/** Well-known type literal set, shared for cross-module assertions. */
export const valueTypes = CONFIG_VALUE_TYPES;