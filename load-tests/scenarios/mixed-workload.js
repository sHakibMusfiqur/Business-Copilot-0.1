

import { check, sleep, group } from 'k6';
import { config, totalWeight } from '../config.js';
import { apiGet, parseJson } from '../helpers/http.js';
import { createSetupFunction, ensureFreshToken } from '../helpers/auth.js';
import { recordSuccess, recordFailure, recordDashboardRequest } from '../helpers/metrics.js';



export const options = {
  thresholds: {
    http_req_failed: [`rate<${config.httpReqFailedThreshold}`],
    http_req_duration: [`p(95)<${config.p95Threshold}`],
  },
};

export const setup = createSetupFunction();

// Weighted endpoint selection
function pickEndpoint(vuId) {
  // Simple hash to distribute VUs deterministically
  const hash = (vuId * 2654435761) >>> 0;
  const roll = hash % totalWeight;

  let cumulative = 0;
  for (const [name, weight] of Object.entries(config.weights)) {
    cumulative += weight;
    if (roll < cumulative) return name;
  }
  return 'dashboard'; // fallback
}

function hitEndpoint(name, token) {
  const page = ((__VU - 1) % 5) + 1;

  switch (name) {
    case 'dashboard':
      return apiGet('/dashboard/overview', token);
    case 'customers':
      return apiGet(`/customers?page=${page}&limit=20`, token);
    case 'employees':
      return apiGet(`/employees?page=${page}&limit=20`, token);
    case 'inventory':
      return apiGet(`/products?page=${page}&limit=20`, token);
    case 'sales':
      return apiGet(`/sales?page=${page}&limit=20`, token);
    case 'payroll':
      return apiGet(`/payroll?page=${page}&limit=20`, token);
    case 'leaves':
      return apiGet(`/leaves?page=${page}&limit=20`, token);
    case 'authMe':
      return apiGet('/auth/me', token);
    default:
      return apiGet('/auth/me', token);
  }
}

export default function (data) {
  // Ensure the VU has a valid (non-expired) access token before making requests.
  // This transparently handles refresh/re-login when the JWT approaches expiry.
  const token = ensureFreshToken(data);

  const endpoint = pickEndpoint(__VU);

  const res = hitEndpoint(endpoint, token);

  const ok = check(res, {
    [`mixed/${endpoint} — status is 2xx`]: (r) => r.status >= 200 && r.status < 300,
  });

  if (endpoint === 'dashboard') {
    // Backend does not emit X-Cache header — record request but cache status is unknown
    const cacheHeader = res.headers['X-Cache'] || res.headers['x-cache'] || '';
    recordDashboardRequest(res.timings.duration, cacheHeader === 'HIT');
  }

  if (ok) {
    recordSuccess(`mixed/${endpoint}`, res.timings.duration);
  } else {
    recordFailure(`mixed/${endpoint}`);
  }

  // Think time: 1–2s (avg 1.5s) — each VU generates ~0.67 RPS
  sleep(1 + Math.random() * 1);
}
