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

  // Payroll list
  const listRes = apiGet(`/payroll?page=${page}&limit=20`, data.token);
  check(listRes, {
    'payroll list — status is 200': (r) => r.status === 200,
  });

  // Payroll stats
  const statsRes = apiGet('/payroll/stats', data.token);
  check(statsRes, {
    'payroll stats — status is 200': (r) => r.status === 200,
  });

  // Detail
  const listBody = parseJson(listRes);
  if (listBody && listBody.data && listBody.data.length > 0) {
    const payId = listBody.data[0].id;
    const detailRes = apiGet(`/payroll/${payId}`, data.token);
    check(detailRes, {
      'payroll detail — status is 200': (r) => r.status === 200,
    });
  }

  sleep(1);
}
