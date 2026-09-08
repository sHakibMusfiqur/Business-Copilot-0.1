

import { check, sleep } from 'k6';
import { config } from '../config.js';
import { apiGet, parseJson } from '../helpers/http.js';
import { createSetupFunction } from '../helpers/auth.js';
import { recordDashboardRequest, recordSuccess, recordFailure } from '../helpers/metrics.js';



export const options = {
  thresholds: {
    http_req_failed: [`rate<${config.httpReqFailedThreshold}`],
    http_req_duration: [`p(95)<${config.p95Threshold}`],
  },
};

export const setup = createSetupFunction();

export default function (data) {
  const res = apiGet('/dashboard/overview', data.token);

  const ok = check(res, {
    'dashboard — status is 200': (r) => r.status === 200,
    'dashboard — has organization': (r) => {
      if (r.status !== 200) return true;
      const body = parseJson(r);
      return body && body.organization;
    },
    'dashboard — has statistics': (r) => {
      if (r.status !== 200) return true;
      const body = parseJson(r);
      return body && body.statistics;
    },
    'dashboard — has dashboardConfig': (r) => {
      if (r.status !== 200) return true;
      const body = parseJson(r);
      return body && body.dashboardConfig;
    },
  });

  // Backend does not emit X-Cache header — record request but cache status is unknown
  const cacheHeader = res.headers['X-Cache'] || res.headers['x-cache'] || '';
  const isCacheHit = cacheHeader === 'HIT';

  recordDashboardRequest(res.timings.duration, isCacheHit);

  if (ok) {
    recordSuccess('dashboard', res.timings.duration);
  } else {
    recordFailure('dashboard');
  }

  sleep(1);
}
