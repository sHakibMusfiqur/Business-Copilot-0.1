const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
const crypto = require('crypto');

const IS_CLEANUP = process.argv.includes('--cleanup');

async function main() {
  const email = process.env.K6_TEST_USERS;
  const password = process.env.K6_TEST_PASSWORD;
  const existingOrgId = process.env.K6_TEST_ORG_ID || null;

  if (!email || !password) {
    console.error('FATAL: Set K6_TEST_USERS and K6_TEST_PASSWORD');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    if (IS_CLEANUP) {
      await cleanup(prisma, email);
    } else {
      await setup(prisma, email, password, existingOrgId);
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function cleanup(prisma, email) {
  console.log('\n=== Cleanup Mode ===\n');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log(`User ${email} not found. Nothing to clean.`);
    return;
  }

  console.log(`Found user: ${email} (${user.id})`);

  await prisma.userRoleAssignment.deleteMany({ where: { userId: user.id } });
  console.log('  Removed role assignments');

  await prisma.organizationMember.deleteMany({ where: { userId: user.id } });
  console.log('  Removed org membership');

  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  console.log('  Removed refresh tokens');

  await prisma.user.delete({ where: { id: user.id } });
  console.log('  Deleted user');

  if (!process.env.K6_TEST_ORG_ID) {
    const org = await prisma.organization.findFirst({ where: { name: 'Load Test Org' } });
    if (org) {
      await prisma.rolePermission.deleteMany({ where: { role: { organizationId: org.id } } });
      await prisma.role.deleteMany({ where: { organizationId: org.id } });
      await prisma.organizationMember.deleteMany({ where: { organizationId: org.id } });
      await prisma.organizationSettings.deleteMany({ where: { organizationId: org.id } });
      await prisma.organization.delete({ where: { id: org.id } });
      console.log(`  Deleted org: ${org.name}`);
    }
  }

  console.log('\nCleanup complete.');
}

async function setup(prisma, email, password, existingOrgId) {
  console.log('\n=== Load-Test User Setup (inside API container) ===\n');

  // 1. Ensure or create organization
  let orgId = existingOrgId;
  let orgName = 'Load Test Org';

  if (!orgId) {
    const existing = await prisma.organization.findFirst({ where: { name: orgName } });
    if (existing) {
      orgId = existing.id;
      console.log(`Using existing org: ${orgName} (${orgId})`);
    } else {
      const org = await prisma.organization.create({
        data: { name: orgName, slug: 'load-test-org', isActive: true },
      });
      orgId = org.id;
      console.log(`Created org: ${orgName} (${orgId})`);
    }
  } else {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      console.error(`Organization ${orgId} not found`);
      process.exit(1);
    }
    orgName = org.name;
    console.log(`Using specified org: ${orgName} (${orgId})`);
  }

  // 2. Ensure Owner role with all permissions
  let ownerRole = await prisma.role.findFirst({
    where: { organizationId: orgId, name: 'Owner' },
  });

  if (!ownerRole) {
    ownerRole = await prisma.role.create({
      data: {
        name: 'Owner',
        description: 'Full access — load testing',
        isSystem: true,
        organizationId: orgId,
      },
    });
    console.log(`Created Owner role: ${ownerRole.id}`);
  } else {
    console.log(`Using existing Owner role: ${ownerRole.id}`);
  }

  // Ensure all permissions are assigned to Owner role
  const allPerms = await prisma.permission.findMany({ select: { id: true } });
  const existingPerms = await prisma.rolePermission.findMany({
    where: { roleId: ownerRole.id },
    select: { permissionId: true },
  });
  const existingPermSet = new Set(existingPerms.map((p) => p.permissionId));
  const missingPerms = allPerms.filter((p) => !existingPermSet.has(p.id));

  if (missingPerms.length > 0) {
    await prisma.rolePermission.createMany({
      data: missingPerms.map((p) => ({ roleId: ownerRole.id, permissionId: p.id })),
    });
    console.log(`  Assigned ${missingPerms.length} missing permissions to Owner role`);
  } else {
    console.log(`  All ${allPerms.length} permissions already assigned`);
  }

  // 3. Hash password using the container's argon2
  const hashedPassword = await argon2.hash(password);
  console.log(`  Password hashed with argon2 (container version)`);

  // 4. Create or update user
  let user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        organizationId: orgId,
        isActive: true,
        emailVerified: true,
        role: 'ADMIN',
      },
    });
    console.log(`Updated user: ${email} (${user.id})`);
  } else {
    user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: 'Load Test User',
        role: 'ADMIN',
        isActive: true,
        emailVerified: true,
        organizationId: orgId,
      },
    });
    console.log(`Created user: ${email} (${user.id})`);
  }

  // 5. Ensure org membership
  const member = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId: user.id } },
  });

  if (!member) {
    await prisma.organizationMember.create({
      data: {
        organizationId: orgId,
        userId: user.id,
        role: 'OWNER',
      },
    });
    console.log('  Added org membership: OWNER');
  } else {
    console.log('  Org membership already exists');
  }

  // 6. Ensure role assignment
  const roleAssignment = await prisma.userRoleAssignment.findUnique({
    where: { userId_roleId: { userId: user.id, roleId: ownerRole.id } },
  });

  if (!roleAssignment) {
    await prisma.userRoleAssignment.create({
      data: { userId: user.id, roleId: ownerRole.id },
    });
    console.log('  Assigned Owner role');
  } else {
    console.log('  Role assignment already exists');
  }

  // 7. Verify
  const verifyUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true, email: true, role: true, organizationId: true,
      isActive: true, emailVerified: true,
    },
  });

  const permCount = await prisma.rolePermission.count({
    where: { roleId: ownerRole.id },
  });

  console.log('\n--- Verification ---');
  console.log(`  User ID:          ${verifyUser.id}`);
  console.log(`  Email:            ${verifyUser.email}`);
  console.log(`  Role (global):    ${verifyUser.role}`);
  console.log(`  organizationId:   ${verifyUser.organizationId}`);
  console.log(`  isActive:         ${verifyUser.isActive}`);
  console.log(`  emailVerified:    ${verifyUser.emailVerified}`);
  console.log(`  RBAC permissions: ${permCount}`);

  const issues = [];
  if (!verifyUser.organizationId) issues.push('organizationId is NULL');
  if (!verifyUser.isActive) issues.push('user is not active');
  if (!verifyUser.emailVerified) issues.push('email not verified');
  if (permCount === 0) issues.push('no RBAC permissions');

  if (issues.length > 0) {
    console.error('\n  ISSUES:');
    issues.forEach((i) => console.error(`    - ${i}`));
    process.exit(1);
  }

  console.log('\n  All checks passed.\n');
  console.log('--- k6 Environment Variables ---');
  console.log(`  K6_TEST_USERS="${email}"`);
  console.log(`  K6_TEST_PASSWORD="${password}"`);
  console.log(`  K6_TEST_ORG_ID="${orgId}"`);
  console.log('');
}

main().catch((e) => {
  console.error('FATAL:', e.message || e);
  process.exit(1);
});
