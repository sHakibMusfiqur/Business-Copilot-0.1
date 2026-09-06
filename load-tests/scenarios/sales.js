

import { check, sleep } from 'k6';
import { config } from '../config.js';
import { apiGet, parseJson } from '../helpers/http.js';
import { createSetupFunction } from '../helpers/auth.js';
import { recordSuccess, recordFailure } from '../helpers/metrics.js';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 200 },
    { duration: '30s', target: 500 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: [`rate<${config.httpReqFailedThreshold}`],
    http_req_duration: [`p(95)<${config.p95Threshold}`],
  },
};

export const setup = createSetupFunction();

export default function (data) {
  const page = ((__VU - 1) % 10) + 1;

  // Sales order list
  const listRes = apiGet(`/sales?page=${page}&limit=20`, data.token);
  check(listRes, {
    'sales list — status is 200': (r) => r.status === 200,
  });

  // Sales stats
  const statsRes = apiGet('/sales/stats', data.token);
  check(statsRes, {
    'sales stats — status is 200': (r) => r.status === 200,
  });

  // Sales detail
  const listBody = parseJson(listRes);
  if (listBody && listBody.data && listBody.data.length > 0) {
    const saleId = listBody.data[0].id;
    const detailRes = apiGet(`/sales/${saleId}`, data.token);
    check(detailRes, {
      'sales detail — status is 200': (r) => r.status === 200,
    });
  }

  sleep(1);
}
