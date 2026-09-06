# load-tests/run-tests.sh
#!/bin/bash
# Run load tests with k6.
# Usage:
#   ./run-tests.sh smoke            — Run smoke test
#   ./run-tests.sh baseline         — Run baseline (normal load)
#   ./run-tests.sh load             — Run load test (heavy)
#   ./run-tests.sh stress           — Run stress test
#   ./run-tests.sh spike            — Run spike test
#   ./run-tests.sh soak             — Run soak test (2 hours)
#   ./run-tests.sh scale-3m         — Run 3M user scale test
#   ./run-tests.sh dashboard-cache  — Run dashboard cache race test
#   ./run-tests.sh mixed            — Run mixed workload
#
# Environment variables:
#   K6_BASE_URL    — API base URL (default: http://localhost:4000/api)
#   K6_TEST_USERS  — Test user email
#   K6_TEST_PASSWORD — Test user password

set -euo pipefail

SCENARIO="${1:-smoke}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== k6 Load Test Runner ==="
echo "Scenario: $SCENARIO"
echo "Target:   ${K6_BASE_URL:-http://localhost:4000/api}"
echo "================================"

case "$SCENARIO" in
  smoke)
    k6 run \
      --out json="$SCRIPT_DIR/reports/smoke-$(date +%Y%m%d-%H%M%S).json" \
      "$SCRIPT_DIR/scenarios/health.js"
    ;;
  baseline)
    k6 run \
      --out json="$SCRIPT_DIR/reports/baseline-$(date +%Y%m%d-%H%M%S).json" \
      "$SCRIPT_DIR/scenarios/mixed-workload.js"
    ;;
  load)
    k6 run \
      --vus 1000 \
      --duration 20m \
      --out json="$SCRIPT_DIR/reports/load-$(date +%Y%m%d-%H%M%S).json" \
      "$SCRIPT_DIR/scenarios/mixed-workload.js"
    ;;
  stress)
    k6 run \
      --vus 3000 \
      --duration 15m \
      --out json="$SCRIPT_DIR/reports/stress-$(date +%Y%m%d-%H%M%S).json" \
      "$SCRIPT_DIR/scenarios/mixed-workload.js"
    ;;
  spike)
    k6 run \
      --out json="$SCRIPT_DIR/reports/spike-$(date +%Y%m%d-%H%M%S).json" \
      "$SCRIPT_DIR/scenarios/mixed-workload.js"
    ;;
  soak)
    k6 run \
      --vus 500 \
      --duration 2h \
      --out json="$SCRIPT_DIR/reports/soak-$(date +%Y%m%d-%H%M%S).json" \
      "$SCRIPT_DIR/scenarios/mixed-workload.js"
    ;;
  scale-3m)
    k6 run \
      --out json="$SCRIPT_DIR/reports/scale-3m-$(date +%Y%m%d-%H%M%S).json" \
      "$SCRIPT_DIR/scenarios/scale-3m.js"
    ;;
  dashboard-cache)
    k6 run \
      --out json="$SCRIPT_DIR/reports/cache-race-$(date +%Y%m%d-%H%M%S).json" \
      "$SCRIPT_DIR/scenarios/dashboard-cache-race.js"
    ;;
  mixed)
    k6 run \
      --out json="$SCRIPT_DIR/reports/mixed-$(date +%Y%m%d-%H%M%S).json" \
      "$SCRIPT_DIR/scenarios/mixed-workload.js"
    ;;
  *)
    echo "Unknown scenario: $SCENARIO"
    echo "Available: smoke, baseline, load, stress, spike, soak, scale-3m, dashboard-cache, mixed"
    exit 1
    ;;
esac

echo ""
echo "=== Test Complete ==="
echo "Results saved to: $SCRIPT_DIR/reports/"
