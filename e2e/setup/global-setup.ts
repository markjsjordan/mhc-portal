import { exec } from 'child_process';
import { promisify } from 'util';
import { Database, DatabaseConfig } from '../../packages/core/src/db/connection.js';
import { seedE2EPersonas } from './seed-personas.js';
import { seedDatabase as seedMobileCaregiver } from './seeds/mobile-caregiver.seed.js';

const execAsync = promisify(exec);

/**
 * Parse PostgreSQL connection URL into DatabaseConfig
 */
function parseDatabaseUrl(url: string): DatabaseConfig {
  const match = url.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid database URL format: ${url}`);
  }

  const [, user, password, host, port, database] = match;
  return {
    host,
    port: parseInt(port, 10),
    database,
    user,
    password,
    ssl: false,
    max: 10,
    idleTimeoutMillis: 30000,
  };
}

/**
 * Global Setup for Playwright E2E Tests
 *
 * This runs once before all tests to:
 * 1. Create test database if not exists
 * 2. Run all migrations
 * 3. Verify database connection
 */
export default async function globalSetup() {
  console.log('\n🔧 Setting up E2E test environment...\n');

  const dbName = process.env['E2E_DATABASE_NAME'] || 'folkcare_e2e_test';
  const dbUrl = process.env['E2E_DATABASE_URL'] || `postgresql://postgres:postgres@localhost:5432/${dbName}`;

  try {
    // Step 1: Create test database if it doesn't exist
    console.log(`📦 Creating test database: ${dbName}...`);
    // Connect over TCP using the same URL the tests use. A bare `createdb`
    // falls back to the Unix socket, which CI runners do not expose.
    const { hostname, port, username, password } = new URL(dbUrl);
    const createEnv = {
      ...process.env,
      PGHOST: hostname,
      PGPORT: port || '5432',
      PGUSER: decodeURIComponent(username),
      PGPASSWORD: decodeURIComponent(password),
    };
    try {
      await execAsync(`createdb ${dbName}`, { env: createEnv });
      console.log(`✅ Database ${dbName} created successfully`);
    } catch (error: unknown) {
      const err = error as Error & { stderr?: string };
      if (err.stderr && err.stderr.includes('already exists')) {
        console.log(`ℹ️  Database ${dbName} already exists, skipping creation`);
      } else {
        // A connection failure here means the tests cannot run; fail loudly
        // instead of continuing against an unreachable database.
        throw new Error(`Could not create E2E database ${dbName}: ${err.message}`);
      }
    }

    // Step 2: Clean E2E test data before migrations (removes personas with known UUIDs)
    console.log('\n🧹 Cleaning E2E test data...');
    const cleanConfig = parseDatabaseUrl(dbUrl);
    const cleanDb = new Database(cleanConfig);
    try {
      // Delete all E2E test data: audit_events are IMMUTABLE so CASCADE won't work;
      // explicitly delete from dependent tables first, then users
      await cleanDb.query(`DELETE FROM audit_events WHERE user_id IN (
        '00000000-e2e0-4000-8000-000000000100',
        '00000000-e2e0-4000-8000-000000000101',
        '00000000-e2e0-4000-8000-000000000102',
        '00000000-e2e0-4000-8000-000000000103',
        '00000000-e2e0-4000-8000-000000000104'
      )`);
      await cleanDb.query(`DELETE FROM auth_events WHERE user_id IN (
        '00000000-e2e0-4000-8000-000000000100',
        '00000000-e2e0-4000-8000-000000000101',
        '00000000-e2e0-4000-8000-000000000102',
        '00000000-e2e0-4000-8000-000000000103',
        '00000000-e2e0-4000-8000-000000000104'
      )`);
      // Delete E2E persona users by their known UUIDs (CASCADE deletes caregivers, etc.)
      const e2eUserIds = [
        '00000000-e2e0-4000-8000-000000000100', // ADMIN_USER
        '00000000-e2e0-4000-8000-000000000101', // ORG_ADMIN_USER
        '00000000-e2e0-4000-8000-000000000102', // COORDINATOR_USER
        '00000000-e2e0-4000-8000-000000000103', // CAREGIVER_USER
        '00000000-e2e0-4000-8000-000000000104', // FAMILY_USER
      ];
      const deleteResult = await cleanDb.query(
        `DELETE FROM users WHERE id = ANY($1::uuid[])`,
        [e2eUserIds]
      );
      console.log(`✅ Cleaned ${deleteResult.rowCount} E2E persona users + dependent data`);
    } catch (error) {
      console.warn('⚠️  Cleanup failed (tables may not exist yet):', error);
    } finally {
      await cleanDb.close();
    }

    // Step 3: Run migrations
    console.log('\n🔄 Running database migrations...');
    const migrationCommand = `DATABASE_URL=${dbUrl} npm run db:migrate --workspace=@folkcare/core`;
    try {
      const { stdout, stderr } = await execAsync(migrationCommand);
      if (stdout) console.log(stdout);
      if (stderr) console.warn(stderr);
      console.log('✅ Migrations completed successfully');
    } catch (error: unknown) {
      const err = error as Error & { stdout?: string; stderr?: string };
      console.error('❌ Migration failed:', err.message);
      if (err.stdout) console.log(err.stdout);
      if (err.stderr) console.error(err.stderr);
      throw error;
    }

    // Step 4: Verify connection
    console.log('\n🔌 Verifying database connection...');
    const config = parseDatabaseUrl(dbUrl);
    const db = new Database(config);
    const isHealthy = await db.healthCheck();
    if (!isHealthy) {
      throw new Error('Database health check failed');
    }
    const result = await db.query<{ version: string }>('SELECT version()');
    console.log(`✅ Connected to PostgreSQL: ${result.rows[0]?.version.split(',')[0]}`);
    await db.close();

    // Step 5: Seed all E2E persona accounts (admin, orgAdmin, coordinator,
    // caregiver, family) and their required portal links. Idempotent via
    // ON CONFLICT DO NOTHING so reruns against a shared DB are safe.
    console.log('\n👤 Seeding E2E persona accounts...');
    const seedDb = new Database(parseDatabaseUrl(dbUrl));
    try {
      await seedE2EPersonas(seedDb);
      console.log('✅ E2E persona accounts ready (admin, orgAdmin, coordinator, caregiver, family)');
    } finally {
      await seedDb.close();
    }

    // Step 6: Seed mobile caregiver fixture (caregiver.mobile@e2e-test.com)
    console.log('\n📱 Seeding mobile caregiver fixture...');
    const mobileDb = new Database(parseDatabaseUrl(dbUrl));
    try {
      await seedMobileCaregiver(mobileDb);
      console.log('✅ Mobile caregiver fixture ready');
    } finally {
      await mobileDb.close();
    }

    console.log('\n✨ E2E test environment ready!\n');
  } catch (error) {
    console.error('\n❌ Failed to set up E2E test environment:', error);
    throw error;
  }
}
