import { PrismaClient } from '@prisma/client';
import { upsertPermissions, syncSystemRoles } from '../src/rbac/permission-catalog';

const prisma = new PrismaClient();

async function main() {
  console.log('Syncing RBAC permissions...');
  const permissions = await upsertPermissions(prisma);
  console.log(`  Permissions: ${permissions.length} upserted`);
  await syncSystemRoles(prisma);
  console.log('RBAC sync completed successfully!');
}

main()
  .catch((e) => {
    console.error('RBAC sync failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
