

import { check, sleep } from 'k6';
import { config } from '../config.js';
import { apiGet, parseJson } from '../helpers/http.js';
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
  const page = ((__VU - 1) % 10) + 1;
  const limit = 20;

  // Test employee list with pagination
  const listRes = apiGet(`/employees?page=${page}&limit=${limit}`, data.token);
  check(listRes, {
    'employees list — status is 200': (r) => r.status === 200,
    'employees list — has data array': (r) => {
      if (r.status !== 200) return true;
      const body = parseJson(r);
      return body && Array.isArray(body.data);
    },
  });

  // Test employee stats
  const statsRes = apiGet('/employees/stats', data.token);
  check(statsRes, {
    'employees stats — status is 200': (r) => r.status === 200,
  });

  // Test individual employee detail (if list returned data)
  const listBody = parseJson(listRes);
  if (listBody && listBody.data && listBody.data.length > 0) {
    const empId = listBody.data[0].id;
    const detailRes = apiGet(`/employees/${empId}`, data.token);
    check(detailRes, {
      'employee detail — status is 200': (r) => r.status === 200,
    });
  }

  sleep(1);
}
