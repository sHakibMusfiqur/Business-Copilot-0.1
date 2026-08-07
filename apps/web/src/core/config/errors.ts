/** Base error type shared by all configuration failures. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Thrown when an operation targets an unknown config id. */
export class ConfigNotFoundError extends ConfigError {
  constructor(id: string) {
    super(`Unknown configuration entry: "${id}".`);
  }
}

/** Thrown when a value fails schema or custom validation. */
export class ConfigValidationError extends ConfigError {
  constructor(id: string, detail: string) {
    super(`Validation failed for "${id}": ${detail}`);
  }
}

/** Thrown when a compute callback returns without a value or throws. */
export class ConfigComputationError extends ConfigError {
  constructor(id: string, detail?: string) {
    super(`Computation failed for "${id}".${detail ? ` ${detail}` : ''}`);
  }
}

/** Thrown when a mutation targets a key registered as `readonly`. */
export class ConfigReadonlyError extends ConfigError {
  constructor(id: string) {
    super(`Configuration entry "${id}" is readonly and cannot be overridden.`);
  }
}