

import { Counter, Rate, Trend } from 'k6/metrics';

// ─── Custom Counters ───────────────────────────────────────────────────────
export const loginSuccess = new Counter('login_success');
export const loginFail = new Counter('login_fail');
export const loginThrottled = new Counter('login_throttled');
export const dashboardRequests = new Counter('dashboard_requests');
export const dashboardCacheHits = new Counter('dashboard_cache_hits');
export const dashboardCacheMisses = new Counter('dashboard_cache_misses');
export const tenantIsolationViolations = new Counter('tenant_isolation_violations');
export const apiErrors = new Counter('api_errors');

// ─── Custom Rates ──────────────────────────────────────────────────────────
export const errorRate = new Rate('error_rate');
export const successRate = new Rate('success_rate');

// ─── Custom Trends ─────────────────────────────────────────────────────────
export const loginDuration = new Trend('login_duration', true);
export const dashboardDuration = new Trend('dashboard_duration', true);
export const permissionCheckDuration = new Trend('permission_check_duration', true);

/**
 * Record a successful API call.
 */
export function recordSuccess(name, duration) {
  successRate.add(true);
  if (name) {
    // Trends are recorded via res.timings.duration in scenarios
  }
}


export function recordFailure(name) {
  errorRate.add(true);
  apiErrors.add(1);
}


export function recordDashboardRequest(durationMs, cacheHit) {
  dashboardRequests.add(1);
  dashboardDuration.add(durationMs);
  if (cacheHit) {
    dashboardCacheHits.add(1);
  } else {
    dashboardCacheMisses.add(1);
  }
}


export function recordLogin(success, throttled, durationMs) {
  loginDuration.add(durationMs);
  if (throttled) {
    loginThrottled.add(1);
  } else if (success) {
    loginSuccess.add(1);
  } else {
    loginFail.add(1);
  }
}
