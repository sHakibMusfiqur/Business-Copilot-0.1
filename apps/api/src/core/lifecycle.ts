export interface LifecycleAware {
  initialize(): void | Promise<void>;
  shutdown?(): void | Promise<void>;
}


export function isLifecycleAware(value: unknown): value is LifecycleAware {
  return (
    typeof value === 'object' &&
    value !== null &&
    'initialize' in value &&
    typeof (value as LifecycleAware).initialize === 'function'
  );
}