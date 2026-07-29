import type { ProvisionResult } from './provisioning-executor.service';

export interface DispatchResult {
  success: boolean;
  result?: ProvisionResult;
  error?: string;
}

export const PROVISION_DISPATCHER = Symbol('PROVISION_DISPATCHER');

export interface ProvisionDispatcher {
  dispatch(sessionId: string): Promise<DispatchResult>;
}
