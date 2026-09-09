
import http from 'k6/http';
import { config } from '../config.js';
import { decodeJwtPayload } from '../helpers/auth.js';

const REQUIRED_ENV = ['K6_TEST_USERS', 'K6_TEST_PASSWORD'];

export const options = {
  vus: 1,
  iterations: 1,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function redact(value) {
  if (!value || typeof value !== 'string') return '(not set)';
  if (value.length <= 4) return '****';
  return value.substring(0, 2) + '****' + value.substring(value.length - 2);
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function () {
  const results = [];
  let loginThrottled = false;

  console.log('\n=== Capacity Test Preflight ===\n');

  // ── 0. Check CAPACITY_TEST flag ──────────────────────────────────────────
  if (__ENV.CAPACITY_TEST !== 'true') {
    console.log('FAIL: CAPACITY_TEST is not "true".');
    console.log('  Capacity Docker override is not active.');
    console.log('  Start with: docker-compose -f docker-compose.yml -f load-tests/docker/docker-compose.capacity.yml up -d --no-deps api');
    return;
  }
  console.log('OK: CAPACITY_TEST=true');

  // ── 1. Check required env vars ───────────────────────────────────────────
  const missing = REQUIRED_ENV.filter((k) => !__ENV[k] || __ENV[k].trim() === '');
  if (missing.length > 0) {
    console.log(`FAIL: Missing required env vars: ${missing.join(', ')}`);
    return;
  }
  console.log('OK: Required env vars present');

  // ── 2. API Health ────────────────────────────────────────────────────────
  const healthUrl = `${config.apiUrl}/health`;
  const healthRes = http.get(healthUrl, { tags: { name: 'preflight' } });
  if (healthRes.status === 200) {
    console.log(`OK: API health -> ${healthUrl}`);
  } else {
    console.log(`FAIL: API health returned ${healthRes.status} at ${healthUrl}`);
    return;
  }

  // ── 3. Login ─────────────────────────────────────────────────────────────
  const loginUrl = `${config.apiUrl}/auth/login`;
  const loginRes = http.post(loginUrl, JSON.stringify({
    email: config.testUserEmail,
    password: config.testUserPassword,
  }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'preflight' },
  });

  if (loginRes.status === 429) {
    console.log('FAIL: LOGIN BLOCKED BY AUTH THROTTLE');
    console.log('  The auth-throttle rate limiter has an active block for this IP/user.');
    console.log('  Clear the Redis auth-throttle state before rerunning.');
    console.log('  Do NOT weaken or modify the AuthThrottleGuard.');
    return;
  }

  if (loginRes.status !== 200 || !loginRes.body) {
    console.log(`FAIL: Login returned ${loginRes.status}`);
    return;
  }

  let tokens;
  try {
    tokens = JSON.parse(loginRes.body);
  } catch (_) {
    console.log('FAIL: Could not parse login response');
    return;
  }

  const accessToken = tokens.accessToken || tokens.access_token;
  if (!accessToken) {
    console.log('FAIL: Login response missing accessToken');
    return;
  }
  console.log('OK: Login');

  // ── 4. JWT contains organization id ──────────────────────────────────────
  const payload = decodeJwtPayload(accessToken);
  if (!payload) {
    console.log('FAIL: Could not decode JWT payload');
    return;
  }
  const orgId = payload.organizationId || payload.orgId || payload.org_id;
  if (!orgId) {
    console.log('FAIL: JWT does not contain organization id');
    console.log('  JWT claims:', Object.keys(payload).join(', '));
    return;
  }
  console.log('OK: JWT organization');

  // ── 5. /auth/me ──────────────────────────────────────────────────────────
  const meRes = http.get(`${config.apiUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    tags: { name: 'preflight' },
  });
  if (meRes.status === 200) {
    console.log('OK: /auth/me');
  } else {
    console.log(`FAIL: /auth/me returned ${meRes.status}`);
    return;
  }

  // ── 6. /dashboard/overview ───────────────────────────────────────────────
  const dashRes = http.get(`${config.apiUrl}/dashboard/overview`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    tags: { name: 'preflight' },
  });
  if (dashRes.status === 200) {
    console.log('OK: /dashboard/overview');
  } else {
    console.log(`FAIL: /dashboard/overview returned ${dashRes.status}`);
    return;
  }

  // ── 7. Throttle override check ───────────────────────────────────────────
  const shortLimit = dashRes.headers['x-ratelimit-limit-short'];
  const mediumLimit = dashRes.headers['x-ratelimit-limit-medium'];
  const longLimit = dashRes.headers['x-ratelimit-limit-long'];

  const shortOk = shortLimit && parseInt(shortLimit) > 10;
  const mediumOk = mediumLimit && parseInt(mediumLimit) > 50;
  const longOk = longLimit && parseInt(longLimit) > 200;

  if (shortOk && mediumOk && longOk) {
    console.log('OK: capacity throttle override');
  } else {
    console.log('FAIL: Throttle override not active');
    if (!shortOk) console.log(`  short=${shortLimit || '(missing)'} expected >10`);
    if (!mediumOk) console.log(`  medium=${mediumLimit || '(missing)'} expected >50`);
    if (!longOk) console.log(`  long=${longLimit || '(missing)'} expected >200`);
    return;
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\nALL CHECKS PASSED — ready for capacity testing.\n');
}
