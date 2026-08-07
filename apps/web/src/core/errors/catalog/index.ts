import type { ErrorDefinition } from '../types';

export const DEFAULT_ERROR_CATALOG: readonly ErrorDefinition[] = [
  // ── Unknown ──────────────────────────────────────────────────────────────
  { code: 'UNKNOWN.ERROR', id: 'unk-001', name: 'Unknown Error', category: 'unknown', severity: 'error', recoverability: 'manual', version: '1.0.0', owner: 'platform', domain: 'platform', description: 'An unrecognised error occurred.' },

  // ── Platform ─────────────────────────────────────────────────────────────
  { code: 'PLATFORM.NOT_IMPLEMENTED', id: 'platform-001', name: 'Not Implemented', category: 'platform', severity: 'warning', recoverability: 'manual', version: '1.0.0', owner: 'platform', domain: 'platform', description: 'The requested platform capability is not yet implemented.', tags: ['engineering'] },
  { code: 'PLATFORM.ENGINE_MISSING', id: 'platform-002', name: 'Engine Missing', category: 'platform', severity: 'critical', recoverability: 'nonRetryable', version: '1.0.0', owner: 'platform', domain: 'kernel', description: 'A required platform engine is not registered.' },

  // ── Configuration ────────────────────────────────────────────────────────
  { code: 'CONFIG.INVALID', id: 'config-001', name: 'Invalid Configuration', category: 'configuration', severity: 'critical', recoverability: 'nonRetryable', version: '1.0.0', owner: 'platform', domain: 'configuration', description: 'A configuration entry failed validation.' },
  { code: 'CONFIG.MISSING', id: 'config-002', name: 'Missing Configuration', category: 'configuration', severity: 'warning', recoverability: 'manual', version: '1.0.0', owner: 'platform', domain: 'configuration', description: 'A required configuration entry is absent.', tags: ['config'] },

  // ── Validation / business ─────────────────────────────────────────────────
  { code: 'VALIDATION.INVALID_INPUT', id: 'validation-001', name: 'Invalid Input', category: 'validation', severity: 'warning', recoverability: 'nonRetryable', version: '1.0.0', owner: 'platform', domain: 'validation', description: 'The provided input does not satisfy constraints.' },
  { code: 'BUSINESS.RULE_VIOLATION', id: 'business-001', name: 'Business Rule Violation', category: 'business', severity: 'warning', recoverability: 'manual', version: '1.0.0', owner: 'business', domain: 'business', description: 'An operation violated a business rule.' },

  // ── Security —───────────────
  { code: 'AUTH.UNAUTHENTICATED', id: 'auth-001', name: 'Unauthenticated', category: 'authentication', severity: 'warning', recoverability: 'manual', version: '1.0.0', owner: 'security', domain: 'security', description: 'The caller could not be authenticated.' },
  { code: 'AUTH.INVALID_CREDENTIALS', id: 'auth-002', name: 'Invalid Credentials', category: 'authentication', severity: 'warning', recoverability: 'manual', version: '1.0.0', owner: 'security', domain: 'security', description: 'The supplied credentials are invalid.' },
  { code: 'SECURITY.UNAUTHORIZED', id: 'security-001', name: 'Unauthorized', category: 'authorization', severity: 'warning', recoverability: 'nonRetryable', version: '1.0.0', owner: 'security', domain: 'security', description: 'The caller lacks permission for the operation.', tags: ['authorization'] },
  { code: 'SECURITY.FORBIDDEN', id: 'security-002', name: 'Forbidden', category: 'authorization', severity: 'warning', recoverability: 'nonRetryable', version: '1.0.0', owner: 'security', domain: 'security', description: 'The caller is identified but not allowed.' },

  // ── Infrastructure ────────────────────────────────────────────────────────
  { code: 'INFRA.UNAVAILABLE', id: 'infra-001', name: 'Infrastructure Unavailable', category: 'infrastructure', severity: 'critical', recoverability: 'retryable', version: '1.0.0', owner: 'infrastructure', domain: 'infrastructure', description: 'A backing infrastructure dependency is unavailable.', retry: { maxAttempts: 3, baseDelayMs: 500, multiplier: 2 } },
  { code: 'STORAGE.UNAVAILABLE', id: 'storage-001', name: 'Storage Unavailable', category: 'storage', severity: 'critical', recoverability: 'retryable', version: '1.0.0', owner: 'infrastructure', domain: 'storage', description: 'Storage backend could not be reached.', retry: { maxAttempts: 3, baseDelayMs: 500, multiplier: 2 } },
  { code: 'SEARCH.UNAVAILABLE', id: 'search-001', name: 'Search Unavailable', category: 'search', severity: 'critical', recoverability: 'retryable', version: '1.0.0', owner: 'infrastructure', domain: 'search', description: 'Search backend could not be reached.', retry: { maxAttempts: 3, baseDelayMs: 500, multiplier: 2 } },

  // ── Intelligence / integration ────────────────────────────────────────────
  { code: 'AI.UNAVAILABLE', id: 'ai-001', name: 'AI Unavailable', category: 'ai', severity: 'warning', recoverability: 'retryable', version: '1.0.0', owner: 'ai', domain: 'ai', description: 'The AI runtime could not be reached.', retry: { maxAttempts: 2, baseDelayMs: 1000 } },
  { code: 'WORKFLOW.FAILED', id: 'workflow-001', name: 'Workflow Failed', category: 'workflow', severity: 'error', recoverability: 'manual', version: '1.0.0', owner: 'workflow', domain: 'workflow', description: 'A workflow execution failed.' },
  { code: 'AUTOMATION.FAILED', id: 'automation-001', name: 'Automation Failed', category: 'automation', severity: 'error', recoverability: 'retryable', version: '1.0.0', owner: 'workflow', domain: 'automation', description: 'An automated run failed.', retry: { maxAttempts: 2, baseDelayMs: 1000 } },
  { code: 'INTEGRATION.FAILED', id: 'integration-001', name: 'Integration Failed', category: 'integration', severity: 'warning', recoverability: 'retryable', version: '1.0.0', owner: 'integration', domain: 'integration', description: 'A third-party integration call failed.', retry: { maxAttempts: 3, baseDelayMs: 1000, multiplier: 2 } },
  { code: 'PLUGIN.FAILED', id: 'plugin-001', name: 'Plugin Failed', category: 'plugin', severity: 'error', recoverability: 'manual', version: '1.0.0', owner: 'plugins', domain: 'plugins', description: 'A plugin raised an error during execution.' },
  { code: 'NOTIFICATION.FAILED', id: 'notification-001', name: 'Notification Failed', category: 'notification', severity: 'warning', recoverability: 'retryable', version: '1.0.0', owner: 'notifications', domain: 'notifications', description: 'A notification could not be delivered.', retry: { maxAttempts: 2, baseDelayMs: 500 } },
  { code: 'SCHEDULER.FAILED', id: 'scheduler-001', name: 'Scheduler Failed', category: 'scheduler', severity: 'warning', recoverability: 'retryable', version: '1.0.0', owner: 'scheduler', domain: 'scheduler', description: 'A scheduled task failed to run.', retry: { maxAttempts: 1, baseDelayMs: 0 } },

  // ── Feature / module ──────────────────────────────────────────────────────
  { code: 'FEATURE.DISABLED', id: 'feature-001', name: 'Feature Disabled', category: 'business', severity: 'warning', recoverability: 'nonRetryable', version: '1.0.0', owner: 'platform', domain: 'features', description: 'The requested feature is not enabled for the scope.', tags: ['feature'] },
  { code: 'MODULE.DISABLED', id: 'module-001', name: 'Module Disabled', category: 'business', severity: 'warning', recoverability: 'nonRetryable', version: '1.0.0', owner: 'platform', domain: 'modules', description: 'The requested module is not enabled for the workspace.', tags: ['module'] },
] as const satisfies readonly ErrorDefinition[];

/** Lookup over the default catalog by code. */
export const DEFAULT_ERROR_CODE_INDEX: ReadonlyMap<string, ErrorDefinition> = new Map(
  DEFAULT_ERROR_CATALOG.map((error) => [error.code, error]),
);

/** Shapes the catalog union type. */
export type ErrorEntry = ErrorDefinition;