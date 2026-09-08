

import { check, sleep } from 'k6';
import http from 'k6/http';
import { config } from '../config.js';

export const options = {
  stages: [
    { duration: '30s', target: 2 },
    { duration: '1m', target: 2 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: [`rate<${config.httpReqFailedThreshold}`],
    http_req_duration: [`p(95)<${config.p95Threshold}`],
  },
};

export default function () {
  const res = http.get(`${config.apiUrl}/health`);
  check(res, {
    'health — status is 200': (r) => r.status === 200,
    'health — has body': (r) => r.body && r.body.length > 0,
  });
  sleep(3);
}
