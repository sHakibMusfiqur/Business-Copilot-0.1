

import { check, sleep } from 'k6';
import { config } from '../config.js';
import { apiGet, parseJson } from '../helpers/http.js';
import { createSetupFunction } from '../helpers/auth.js';
import { recordDashboardRequest, recordSuccess, recordFailure } from '../helpers/metrics.js';

export const options = {

  stages: [
    { duration: '5m', target: 1000 },
    { duration: '10m', target: 5000 },
    { duration: '15m', target: 10000 },
    { duration: '5m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
  },
};

export const setup = createSetupFunction();

export default function (data) {
  const endpoints = [
    { name: 'dashboard', path: '/dashboard/overview', weight: 35 },
    { name: 'customers', path: '/customers?page=1&limit=20', weight: 15 },
    { name: 'employees', path: '/employees?page=1&limit=20', weight: 10 },
    { name: 'inventory', path: '/products?page=1&limit=20', weight: 10 },
    { name: 'sales', path: '/sales?page=1&limit=20', weight: 10 },
    { name: 'authMe', path: '/auth/me', weight: 20 },
  ];

  // Pick endpoint based on VU
  const totalWeight = endpoints.reduce((sum, e) => sum + e.weight, 0);
  const roll = (__VU * 7 + __ITER * 3) % totalWeight;
  let cumulative = 0;
  let picked = endpoints[0];
  for (const ep of endpoints) {
    cumulative += ep.weight;
    if (roll < cumulative) { picked = ep; break; }
  }

  const res = apiGet(picked.path, data.token);

  const ok = check(res, {
    [`${picked.name} — status 2xx`]: (r) => r.status >= 200 && r.status < 300,
  });

  if (picked.name === 'dashboard') {
    const cacheHeader = res.headers['X-Cache'] || res.headers['x-cache'] || '';
    recordDashboardRequest(res.timings.duration, cacheHeader === 'HIT');
  }

  if (ok) {
    recordSuccess(picked.name, res.timings.duration);
  } else {
    recordFailure(picked.name);
  }

  sleep(0.5 + Math.random() * 2);
}
