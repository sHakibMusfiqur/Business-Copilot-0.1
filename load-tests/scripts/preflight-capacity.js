
import http from 'k6/http';
import { check, sleep } from 'k6';
import { config } from '../config.js';
import { login, getMe, decodeJwtPayload } from '../helpers/auth.js';

const REQUIRED_ENV = ['K6_TEST_USERS', 'K6_TEST_PASSWORD'];

export const options = {
  vus: 1,
  duration: '1m',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function redact(value) {
  if (!value || typeof value !== 'string') return '(not set)';
  if (value.length <= 4) return '****';
  return value.substring(0, 2) + '****' + value.substring(value.length - 2);
}

function safeLog(label, value) {
  console.log(`  ${label}: ${value}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function () {
  let failures = 0;

  console.log('\n=== Capacity Test Preflight ===\n');

  // ── 0. Check CAPACITY_TEST flag ──────────────────────────────────────────
  const capacityTest = __ENV.CAPACITY_TEST;
  if (capacityTest !== 'true') {
    console.error('FAIL: CAPACITY_TEST is not "true".');
    console.error('  Capacity Docker override is not active.');
    console.error('  Start with: docker-compose -f docker-compose.yml -f load-tests/docker/docker-compose.capacity.yml up -d --no-deps api');
    failures++;
  } else {
    console.log('OK: CAPACITY_TEST=true');
  }

  // ── 1. Check required env vars ───────────────────────────────────────────
  const missing = REQUIRED_ENV.filter((k) => !__ENV[k] || __ENV[k].trim() === '');
  if (missing.length > 0) {
    console.error(`FAIL: Missing required env vars: ${missing.join(', ')}`);
    failures++;
  } else {
    console.log('OK: Required env vars present');
  }

  // ── 2. Print safe config ─────────────────────────────────────────────────
  console.log('\n--- Safe Configuration ---');
  safeLog('API URL', config.apiUrl);
  safeLog('Test User Email', redact(config.testUserEmail));
  safeLog('Test Org ID', config.testOrgId || '(not set)');
  safeLog('CAPACITY_TEST', capacityTest || '(not set)');

  // ── 3. API Health ────────────────────────────────────────────────────────
  console.log('\n--- API Health ---');
  const healthRes = http.get(`${config.apiUrl}/../health`, { tags: { name: 'preflight' } });
  const healthOk = healthRes.status === 200;
  if (healthOk) {
    console.log('OK: API health endpoint returned 200');
  } else {
    console.error(`FAIL: API health returned ${healthRes.status}`);
    failures++;
  }

  // ── 4. Login ─────────────────────────────────────────────────────────────
  console.log('\n--- Authentication ---');
  if (config.testUserEmail && config.testUserPassword) {
    const tokens = login(config.testUserEmail, config.testUserPassword);
    if (!tokens || !tokens.accessToken) {
      console.error('FAIL: Login failed');
      failures++;
    } else {
      console.log('OK: Login succeeded');

      // ── 5. JWT contains organization id ───────────────────────────────────
      const payload = decodeJwtPayload(tokens.accessToken);
      if (!payload) {
        console.error('FAIL: Could not decode JWT payload');
        failures++;
      } else {
        const orgId = payload.organizationId || payload.orgId || payload.org_id;
        if (!orgId) {
          console.error('FAIL: JWT does not contain organization id');
          console.error('  JWT claims:', Object.keys(payload).join(', '));
          failures++;
        } else {
          console.log('OK: JWT contains organization id');
        }

        // Never print the actual JWT
        console.log('  JWT expiry:', payload.exp ? new Date(payload.exp * 1000).toISOString() : '(unknown)');
      }

      // ── 6. /auth/me ──────────────────────────────────────────────────────
      console.log('\n--- Endpoint Checks ---');
      const meRes = http.get(`${config.apiUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
        tags: { name: 'preflight' },
      });
      if (meRes.status === 200) {
        console.log('OK: /auth/me returned 200');
      } else {
        console.error(`FAIL: /auth/me returned ${meRes.status}`);
        failures++;
      }

      // ── 7. /dashboard/overview ────────────────────────────────────────────
      const dashRes = http.get(`${config.apiUrl}/dashboard/overview`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
        tags: { name: 'preflight' },
      });
      if (dashRes.status === 200) {
        console.log('OK: /dashboard/overview returned 200');

        // ── 8. dashboardConfig exists ───────────────────────────────────────
        try {
          const body = JSON.parse(dashRes.body);
          const hasConfig = body.dashboardConfig !== undefined || body.config !== undefined || body.data !== undefined;
          if (hasConfig) {
            console.log('OK: Response contains dashboard data/config');
          } else {
            console.log('WARN: Response body does not contain expected dashboardConfig key');
            console.log('  Top-level keys:', Object.keys(body).join(', '));
          }
        } catch (e) {
          console.log('WARN: Could not parse dashboard response body');
        }
      } else {
        console.error(`FAIL: /dashboard/overview returned ${dashRes.status}`);
        failures++;
      }

      // ── 9. Check throttle headers (verify capacity override is active) ───
      console.log('\n--- Throttle Override Check ---');
      const shortLimit = dashRes.headers['x-ratelimit-limit-short'];
      const mediumLimit = dashRes.headers['x-ratelimit-limit-medium'];
      const longLimit = dashRes.headers['x-ratelimit-limit-long'];

      if (shortLimit && parseInt(shortLimit) > 10) {
        console.log(`OK: short bucket limit = ${shortLimit} (elevated, override active)`);
      } else if (shortLimit) {
        console.error(`FAIL: short bucket limit = ${shortLimit} (expected > 10 for capacity test)`);
        console.error('  Capacity Docker override may not be active.');
        failures++;
      } else {
        console.log('SKIP: No throttle headers in response (may be blocked)');
      }

      if (mediumLimit && parseInt(mediumLimit) > 50) {
        console.log(`OK: medium bucket limit = ${mediumLimit} (elevated, override active)`);
      } else if (mediumLimit) {
        console.error(`FAIL: medium bucket limit = ${mediumLimit} (expected > 50 for capacity test)`);
        failures++;
      }

      if (longLimit && parseInt(longLimit) > 200) {
        console.log(`OK: long bucket limit = ${longLimit} (elevated, override active)`);
      } else if (longLimit) {
        console.error(`FAIL: long bucket limit = ${longLimit} (expected > 200 for capacity test)`);
        failures++;
      }
    }
  } else {
    console.error('SKIP: Cannot test auth — credentials not set');
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n=== Preflight Summary ===');
  if (failures === 0) {
    console.log('ALL CHECKS PASSED — ready for capacity testing.');
  } else {
    console.error(`${failures} check(s) FAILED — fix issues before running capacity test.`);
  }
  console.log('');
}
