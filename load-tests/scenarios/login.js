

import { check, sleep } from 'k6';
import { config } from '../config.js';
import { publicPost, parseJson } from '../helpers/http.js';
import { recordLogin } from '../helpers/metrics.js';
import { getUsers } from '../helpers/users.js';



export const options = {
  thresholds: {
    http_req_failed: [`rate<${config.httpReqFailedThreshold}`],
    http_req_duration: [`p(95)<${config.p95Threshold}`],
  },
};

export default function () {
  const users = getUsers();
  const user = users[(__VU - 1) % users.length];

  const startTime = Date.now();
  const res = publicPost('/auth/login', {
    email: user.email,
    password: user.password,
  });
  const duration = Date.now() - startTime;

  const throttled = res.status === 429;
  const success = res.status === 200;

  check(res, {
    'login — status is 200 or 429': (r) => r.status === 200 || r.status === 429,
    'login — has token on success': (r) => {
      if (r.status !== 200) return true;
      const body = parseJson(r);
      return body && (body.accessToken || body.access_token);
    },
  });

  recordLogin(success, throttled, duration);
  sleep(1);
}
