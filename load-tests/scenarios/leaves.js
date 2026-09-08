

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

  // Leaves list
  const listRes = apiGet(`/leaves?page=${page}&limit=20`, data.token);
  check(listRes, {
    'leaves list — status is 200': (r) => r.status === 200,
  });

  // Leaves stats
  const statsRes = apiGet('/leaves/stats', data.token);
  check(statsRes, {
    'leaves stats — status is 200': (r) => r.status === 200,
  });

  // Detail
  const listBody = parseJson(listRes);
  if (listBody && listBody.data && listBody.data.length > 0) {
    const leaveId = listBody.data[0].id;
    const detailRes = apiGet(`/leaves/${leaveId}`, data.token);
    check(detailRes, {
      'leave detail — status is 200': (r) => r.status === 200,
    });
  }

  sleep(1);
}
