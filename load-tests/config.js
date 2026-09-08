

export const config = {
  // ─── Target ────────────────────────────────────────────────────────────────
  baseUrl: __ENV.K6_BASE_URL || 'http://localhost:3000',
  apiUrl: __ENV.K6_API_URL || 'http://localhost:4000/api',

  // ─── Test User Pool ────────────────────────────────────────────────────────
  
  testUserEmail: __ENV.K6_TEST_USERS || '',
  testUserPassword: __ENV.K6_TEST_PASSWORD || '',
  testOrgId: __ENV.K6_TEST_ORG_ID || '',

  // ─── Thresholds ────────────────────────────────────────────────────────────
  httpReqFailedThreshold: parseFloat(__ENV.K6_HTTP_REQ_FAILED_THRESHOLD || '0.01'),
  p95Threshold: parseFloat(__ENV.K6_P95_THRESHOLD || '1000'),
  p99Threshold: parseFloat(__ENV.K6_P99_THRESHOLD || '2000'),

  // ─── Scenario ──────────────────────────────────────────────────────────────
  scenario: __ENV.K6_SCENARIO || 'smoke',

  // ─── VU & Duration (used by CLI overrides) ─────────────────────────────────
  vus: parseInt(__ENV.K6_VUS || '10', 10),
  duration: __ENV.K6_DURATION || '5m',

  // ─── Weights for Mixed Workload ────────────────────────────────────────────
  weights: {
    dashboard: parseInt(__ENV.DASHBOARD_WEIGHT || '35', 10),
    customers: parseInt(__ENV.CUSTOMERS_WEIGHT || '15', 10),
    employees: parseInt(__ENV.EMPLOYEES_WEIGHT || '10', 10),
    inventory: parseInt(__ENV.INVENTORY_WEIGHT || '10', 10),
    sales: parseInt(__ENV.SALES_WEIGHT || '10', 10),
    payroll: parseInt(__ENV.PAYROLL_WEIGHT || '7', 10),
    leaves: parseInt(__ENV.LEAVES_WEIGHT || '5', 10),
    authMe: parseInt(__ENV.AUTH_ME_WEIGHT || '5', 10),
    other: parseInt(__ENV.OTHER_WEIGHT || '3', 10),
  },

  // ─── Industries for Dashboard Testing ──────────────────────────────────────
  industries: [
    'restaurant', 'hospital', 'manufacturing', 'school',
    'software', 'retail', 'pharmacy', 'garments',
    'it-services', 'general',
  ],
};

// Derived
export const totalWeight = Object.values(config.weights).reduce((a, b) => a + b, 0);
