

import { check, sleep } from 'k6';
import { config } from '../config.js';
import { apiGet, parseJson } from '../helpers/http.js';
import { createSetupFunction } from '../helpers/auth.js';
import { Counter } from 'k6/metrics';

const cacheConflicts = new Counter('dashboard_cache_conflicts');

export const options = {
  // Fixed VUs, high iteration rate — simulates cache stampede
  vus: 50,
  iterations: 500,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1500'],
  },
};

export const setup = createSetupFunction();

export default function (data) {
  const res = apiGet('/dashboard/overview', data.token);

  const ok = check(res, {
    'cache-race — status is 200': (r) => r.status === 200,
    'cache-race — has orgId': (r) => {
      if (r.status !== 200) return true;
      const body = parseJson(r);
      return body && body.organization && body.organization.id;
    },
  });

  if (ok) {
    const body = parseJson(res);
    // Verify the returned org matches our test org
    if (body && body.organization) {
      const returnedOrgId = body.organization.id;
      const expectedOrgId = data.orgId || body.organization.id;
      if (returnedOrgId !== expectedOrgId) {
        cacheConflicts.add(1);
      }
    }
  }

  sleep(0.2);
}
