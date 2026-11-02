const { PrismaClient } = require('@prisma/client');

async function run() {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    console.log('🔗 Connected to database for pre-migration preparation...');

    // 1. Ensure organizations table exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "organizations" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "slug" TEXT UNIQUE NOT NULL,
        "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Ensure default organization
    const orgs = await prisma.$queryRawUnsafe(`SELECT id FROM "organizations" LIMIT 1;`);
    let orgId = orgs[0]?.id;
    if (!orgId) {
      orgId = 'org_default_sentinel_01';
      await prisma.$executeRawUnsafe(`
        INSERT INTO "organizations" ("id", "name", "slug")
        VALUES ('${orgId}', 'Acme Observability Corp', 'acme-corp')
        ON CONFLICT ("id") DO NOTHING;
      `);
    }

    // 3. For each table with organization_id, add column if missing and backfill NULLs
    const tables = [
      'alert_rules',
      'api_collections',
      'apis',
      'dashboards',
      'environments',
      'incidents',
      'load_tests',
      'monitors',
      'saved_api_requests',
      'api_request_histories',
    ];

    for (const table of tables) {
      const regCheck = await prisma.$queryRawUnsafe(`
        SELECT to_regclass('public."' || '${table}' || '"')::text as reg;
      `);
      if (regCheck[0]?.reg) {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;
        `);
        await prisma.$executeRawUnsafe(`
          UPDATE "${table}" SET "organization_id" = '${orgId}' WHERE "organization_id" IS NULL;
        `);
      }
    }

    console.log('✅ Database pre-migration backfill complete.');
  } catch (err) {
    console.warn('DB prep notice:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
