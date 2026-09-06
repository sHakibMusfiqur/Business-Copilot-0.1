// load-tests/data/generate-test-users.js
// Generate test users CSV for load testing.
// Run with: node generate-test-users.js [count]
// Default: 1000 users across 100 organizations.

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const COUNT = parseInt(process.argv[2] || '1000', 10);
const ORG_COUNT = Math.max(1, Math.ceil(COUNT / 10)); // ~10 users per org

async function generate() {
  const password = 'LoadTest@123';
  const passwordHash = await bcrypt.hash(password, 10);

  const lines = [`email,password,orgId`];

  for (let i = 0; i < COUNT; i++) {
    const orgId = `org-${String(Math.floor(i / 10) + 1).padStart(4, '0')}`;
    const email = `loaduser-${i + 1}@loadtest.local`;
    lines.push(`${email},${password},${orgId}`);
  }

  const outPath = path.join(__dirname, 'test-users.csv');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`Generated ${COUNT} test users → ${outPath}`);
  console.log(`Organizations: ${ORG_COUNT}`);
  console.log(`Password: ${password}`);
}

generate().catch(console.error);
