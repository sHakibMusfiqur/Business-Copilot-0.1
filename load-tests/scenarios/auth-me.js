

import { check, sleep } from 'k6';
import { config } from '../config.js';
import { apiGet } from '../helpers/http.js';
import { createSetupFunction } from '../helpers/auth.js';
import { recordSuccess, recordFailure } from '../helpers/metrics.js';



export const options = {
  thresholds: {
    http_req_failed: [`rate<${config.httpReqFailedThreshold}`],
    http_req_duration: [`p(95)<${config.p95Threshold}`],
  },
};

export const setup = createSetupFunction();

export default function (data) {
  const res = apiGet('/auth/me', data.token);

  const ok = check(res, {
    'auth/me — status is 200': (r) => r.status === 200,
    'auth/me — has user data': (r) => r.status !== 200 || (r.body && r.body.length > 10),
  });

  if (ok) {
    recordSuccess('auth/me', res.timings.duration);
  } else {
    recordFailure('auth/me');
  }

  sleep(0.5);
}
