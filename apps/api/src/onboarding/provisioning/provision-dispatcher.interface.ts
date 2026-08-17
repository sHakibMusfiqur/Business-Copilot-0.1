import type { ProvisionResult } from './provisioning-executor.service';

export interface DispatchResult {
  success: boolean;
  result?: ProvisionResult;
  error?: string;
  /** The checkpoint id that failed, when the failure is attributable to one. */
  failedTask?: string;
}

export const PROVISION_DISPATCHER = Symbol('PROVISION_DISPATCHER');

export interface ProvisionDispatcher {
  dispatch(sessionId: string): Promise<DispatchResult>;
}
