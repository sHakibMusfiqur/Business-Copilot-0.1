

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

  // Customer list with pagination
  const listRes = apiGet(`/customers?page=${page}&limit=20`, data.token);
  check(listRes, {
    'customers list — status is 200': (r) => r.status === 200,
    'customers list — has data': (r) => {
      if (r.status !== 200) return true;
      const body = parseJson(r);
      return body && Array.isArray(body.data);
    },
  });

  // Customer stats
  const statsRes = apiGet('/customers/stats', data.token);
  check(statsRes, {
    'customers stats — status is 200': (r) => r.status === 200,
  });

  // Customer search
  const searchRes = apiGet('/customers?search=test', data.token);
  check(searchRes, {
    'customers search — status is 200': (r) => r.status === 200,
  });

  // Customer detail
  const listBody = parseJson(listRes);
  if (listBody && listBody.data && listBody.data.length > 0) {
    const custId = listBody.data[0].id;
    const detailRes = apiGet(`/customers/${custId}`, data.token);
    check(detailRes, {
      'customer detail — status is 200': (r) => r.status === 200,
    });
  }

  sleep(1);
}
