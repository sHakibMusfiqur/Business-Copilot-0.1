import type { IndustryTemplate, ProvisioningConfig } from './types';

/**
 * Context passed to every industry provider lifecycle hook.
 * Contains the session data needed to provision the organization.
 */
export interface ProvisioningContext {
  /** The onboarding session ID */
  sessionId: string;
  /** The authenticated user ID, if available */
  userId?: string;
  /** The organization name chosen during onboarding */
  orgName: string;
  /** The organization email, if provided */
  orgEmail?: string;
  /** The selected industry template ID */
  selectedIndustry: string;
  /** The modules the user opted into */
  selectedModules: string[];
  /** Additional business profile fields collected during onboarding */
  businessProfile?: Record<string, unknown>;
}

/**
 * Industry template provider lifecycle interface.
 *
 * Each industry (Retail, Manufacturing, Services, Hospitality) implements this
 * interface to provide industry-specific provisioning logic. The lifecycle
 * consists of five hooks called in order:
 *
 * 1. `validate`   — pre-flight checks before any work begins
 * 2. `prepare`    — allocate IDs, sequences, or reservation resources (inside DB transaction)
 * 3. `provision`  — create industry-specific records (inside DB transaction)
 * 4. `postProvision` — fire-and-forget side effects after the transaction commits
 * 5. `cleanup`    — release any reserved resources if provisioning fails
 *
 * Hooks 1 and 5 run **outside** the main DB transaction.
 * Hooks 2 and 3 run **inside** the main DB transaction — throw to roll back.
 * Hook 4 runs **after** the transaction commits — errors are logged but not fatal.
 */
export interface IndustryTemplateProvider {
  /** Unique identifier matching the template ID (e.g. 'retail', 'manufacturing') */
  readonly id: string;

  /** Returns the industry template metadata (UI labels, default modules, etc.) */
  getTemplate(): IndustryTemplate;

  /** Returns the provisioning configuration (departments, roles, COA, widgets, defaults) */
  getProvisioningConfig(): ProvisioningConfig;

  /**
   * Pre-flight validation before provisioning begins.
   * Called **outside** any DB transaction. Throw to abort provisioning.
   * Use this to verify external prerequisites or configuration validity.
   */
  validate?(context: ProvisioningContext): Promise<void> | void;

  /**
   * Prepare industry-specific resources inside the provisioning transaction.
   * Called **inside** the DB transaction. Throw to trigger a full rollback.
   * Use this to allocate numbering sequences, create stub records, or
   * reserve identifiers that downstream hooks will use.
   */
  prepare?(tx: unknown, context: ProvisioningContext): Promise<void> | void;

  /**
   * Create industry-specific provisioning records inside the transaction.
   * Called **inside** the DB transaction after `prepare`. Throw to roll back.
   * Use this to configure industry-specific ledger accounts, inventory
   * categories, tax defaults, etc.
   */
  provision?(tx: unknown, context: ProvisioningContext, orgId: string): Promise<void> | void;

  /**
   * Fire-and-forget post-provisioning side effects.
   * Called **after** the transaction commits. Errors are logged but do NOT
   * fail the overall provisioning. Use this for non-critical operations like
   * sending welcome emails, enqueuing async jobs, or warming caches.
   */
  postProvision?(context: ProvisioningContext, orgId: string): Promise<void> | void;

  /**
   * Cleanup resources when provisioning fails.
   * Called **outside** any DB transaction. Errors are logged but do NOT
   * throw. Use this to release reserved IDs, delete partial external
   * resources, or mark the provisioning attempt as abandoned.
   */
  cleanup?(sessionId: string): Promise<void> | void;
}

export const INDUSTRY_PROVIDER_TOKEN = 'INDUSTRY_TEMPLATE_PROVIDER';
