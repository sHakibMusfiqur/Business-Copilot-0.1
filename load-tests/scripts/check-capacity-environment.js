

import { config } from '../config.js';

export const options = {
  vus: 1,
  iterations: 1,
};

function safeLog(label, value) {
  console.log(`  ${label.padEnd(30)} ${value}`);
}

export default function () {
  console.log('');
  console.log('=== Capacity Test Environment ===');
  console.log('');

  safeLog('API URL', config.apiUrl || '(not set)');
  safeLog('Base URL', config.baseUrl || '(not set)');

  // Throttle limits
  const shortLimit = __ENV.THROTTLE_SHORT_LIMIT || '(default: 10)';
  const mediumLimit = __ENV.THROTTLE_MEDIUM_LIMIT || '(default: 50)';
  const longLimit = __ENV.THROTTLE_LONG_LIMIT || '(default: 200)';
  safeLog('Throttle Short Limit', shortLimit);
  safeLog('Throttle Medium Limit', mediumLimit);
  safeLog('Throttle Long Limit', longLimit);

  // Capacity test flag
  const capacityTest = __ENV.CAPACITY_TEST || '(not set)';
  safeLog('CAPACITY_TEST', capacityTest);

  // Test user (email domain only, never the full email)
  const email = config.testUserEmail || '';
  const domain = email.includes('@') ? '@' + email.split('@')[1] : '(not set)';
  safeLog('Test User Domain', domain);

  // Org ID (safe to display — not a secret)
  safeLog('Test Org ID', config.testOrgId || '(not set)');

  // VU/duration defaults (for info only — CLI overrides take precedence)
  safeLog('Default VUs (env)', String(config.vus));
  safeLog('Default Duration (env)', config.duration);

  console.log('');
  console.log('=== Weight Distribution ===');
  console.log('');
  for (const [name, weight] of Object.entries(config.weights)) {
    safeLog(name, String(weight));
  }

  console.log('');
  console.log('=== Summary ===');
  console.log('');
  if (capacityTest === 'true') {
    console.log('  CAPACITY_TEST is active. Throttle overrides should be in effect.');
  } else {
    console.log('  CAPACITY_TEST is NOT set. Throttle overrides are NOT active.');
    console.log('  To enable: docker-compose -f docker-compose.yml -f load-tests/docker/docker-compose.capacity.yml up -d --no-deps api');
  }
  console.log('');
}
