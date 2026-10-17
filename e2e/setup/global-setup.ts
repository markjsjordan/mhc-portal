import { exec } from 'child_process';
import { promisify } from 'util';
import { Database, DatabaseConfig } from '../../packages/core/src/db/connection.js';
import { PasswordUtils } from '../../packages/core/src/utils/password-utils.js';
import { E2E_UUIDS } from '../fixtures/test-data.js';

/**
 * The admin the specs log in as. IDs come from the shared fixture so the
 * seeded account matches the rest of the E2E data. Email and password are the
 * credentials the specs already use (see e2e/tests/*.spec.ts).
 */
const E2E_ADMIN = {
  orgId: E2E_UUIDS.ORG_E2E,
  userId: E2E_UUIDS.ADMIN_USER,
  email: 'admin@folkcare.example',
  password: 'Admin123!',
};

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

    // Step 2: Run migrations
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

    // Step 3: Verify connection
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

    // Step 4: Seed the admin account the specs log in as. Specs use
    // admin@folkcare.example with the shared E2E password; the password is
    // hashed with the project's own PasswordUtils so the real login path can
    // verify it. Idempotent (ON CONFLICT), so reruns against a shared DB are safe.
    console.log('\n👤 Seeding E2E admin account...');
    const seedDb = new Database(parseDatabaseUrl(dbUrl));
    try {
      await seedDb.query(
        `INSERT INTO organizations (id, name, primary_address, status, created_at, created_by, updated_at, updated_by, version)
         VALUES ($1, $2, $3, 'ACTIVE', NOW(), $1, NOW(), $1, 1)
         ON CONFLICT (id) DO NOTHING`,
        [E2E_ADMIN.orgId, 'E2E Test Organization', JSON.stringify({ street: '1 Test Ln', city: 'Austin', state: 'TX', postalCode: '78701', country: 'USA' })]
      );
      await seedDb.query(
        `INSERT INTO users (id, organization_id, username, email, password_hash, first_name, last_name, status, roles, permissions, created_at, created_by, updated_at, updated_by, version)
         VALUES ($1, $2, $3, $4, $5, 'Admin', 'User', 'ACTIVE', $6, $7, NOW(), $1, NOW(), $1, 1)
         ON CONFLICT DO NOTHING`,
        [
          E2E_ADMIN.userId,
          E2E_ADMIN.orgId,
          'admin',
          E2E_ADMIN.email,
          PasswordUtils.hashPassword(E2E_ADMIN.password),
          ['SUPER_ADMIN'],
          ['*:*'],
        ]
      );
      console.log(`✅ Admin account ready: ${E2E_ADMIN.email}`);
    } finally {
      await seedDb.close();
    }

    console.log('\n✨ E2E test environment ready!\n');
  } catch (error) {
    console.error('\n❌ Failed to set up E2E test environment:', error);
    throw error;
  }
}
