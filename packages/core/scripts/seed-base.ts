/**
 * Base Data Seeding Script - DEV/PREVIEW ONLY
 *
 * Seeds ONLY operational data required for any installation:
 * - Organization (minimal template)
 * - Branch (minimal template)
 * - Admin user (for first login)
 * - Family user (for family portal demo)
 * 
 * This script is idempotent and can be run multiple times safely.
 * It uses ON CONFLICT DO UPDATE to ensure data consistency.
 * 
 * ⚠️  ENVIRONMENT SAFETY:
 * - This script should ONLY be run against dev/preview databases
 * - NEVER run against production (DATABASE_URL ending in flat-hat-84119673.*.neon.tech)
 * - The script includes an environment guard to prevent production use
 * 
 * Usage:
 *   npm run db:seed:base    # Seeds base operational data
 * 
 * NOTE: Demo data (clients, caregivers, visits, etc.) is seeded via the
 * db:seed:demo script, which runs after base seeding to keep data evergreen.
 * 
 * Created: 2026-01-25 (moved from migration 20251121000000_seed_base_data.ts)
 * Reason: https://app.clickup.com/t/wdvf3ac2zk (Oct 2026 production incident)
 */

import { config as dotenvConfig } from "dotenv";
import { Pool } from 'pg';
import { PasswordUtils } from '../src/utils/password-utils.js';

dotenvConfig({ path: '.env', quiet: true });

// Fixed UUIDs for base data (ensures consistency across environments)
const FIXED_ORG_ID = '00000000-0000-0000-0000-000000000001';
const FIXED_BRANCH_ID = '00000000-0000-0000-0000-000000000002';
const FIXED_ADMIN_ID = '00000000-0000-0000-0000-000000000003';
const FIXED_FAMILY_ID = '00000000-0000-0000-0000-000000000004';

/**
 * Environment guard - prevents accidental execution against production
 */
function validateEnvironment(): void {
  const dbUrl = process.env.DATABASE_URL || '';
  
  // Check for production database indicators
  const isProduction = 
    dbUrl.includes('flat-hat-84119673') ||  // Neon production project
    process.env.ENVIRONMENT === 'production' ||
    process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    console.error('❌ ERROR: Refusing to seed base data in production environment');
    console.error('   DATABASE_URL:', dbUrl.replace(/:[^:@]+@/, ':***@')); // Mask password
    console.error('   ENVIRONMENT:', process.env.ENVIRONMENT);
    console.error('   NODE_ENV:', process.env.NODE_ENV);
    console.error('');
    console.error('   Base seeding is for dev/preview environments only.');
    console.error('   Production should use secure signup with real credentials.');
    console.error('');
    process.exit(1);
  }
  
  console.log('✅ Environment check passed: non-production database detected\n');
}

/**
 * Seeds base operational data
 */
async function seedBaseData(): Promise<void> {
  console.log('🌱 Seeding base operational data...\n');
  
  validateEnvironment();
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // ==========================================================================
    // STEP 1: Create minimal organization
    // ==========================================================================
    console.log('Creating organization...');
    
    await pool.query(`
      INSERT INTO organizations (
        id, name, legal_name, phone, email, primary_address,
        status, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        legal_name = EXCLUDED.legal_name,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        primary_address = EXCLUDED.primary_address,
        status = EXCLUDED.status,
        updated_at = NOW()
    `, [
      FIXED_ORG_ID,
      'Folk Home Health',
      'Folk Home Health Services, Inc.',
      '555-0100',
      'info@folkcare.example',
      JSON.stringify({
        line1: '123 Main Street',
        city: 'Springfield',
        state: 'IL',
        postalCode: '62701',
        country: 'US',
      }),
      'ACTIVE',
      FIXED_ADMIN_ID,
      FIXED_ADMIN_ID,
    ]);

    // ==========================================================================
    // STEP 2: Create branch
    // ==========================================================================
    console.log('Creating branch...');
    
    await pool.query(`
      INSERT INTO branches (
        id, organization_id, name, code, phone, address,
        status, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        code = EXCLUDED.code,
        phone = EXCLUDED.phone,
        address = EXCLUDED.address,
        status = EXCLUDED.status,
        updated_at = NOW()
    `, [
      FIXED_BRANCH_ID,
      FIXED_ORG_ID,
      'Main Office',
      'MAIN',
      '555-0101',
      JSON.stringify({
        line1: '123 Main Street',
        city: 'Springfield',
        state: 'IL',
        postalCode: '62701',
        country: 'US',
      }),
      'ACTIVE',
      FIXED_ADMIN_ID,
      FIXED_ADMIN_ID,
    ]);

    // ==========================================================================
    // STEP 3: Create admin user
    // Password: Admin123!
    // ==========================================================================
    console.log('Creating admin user...');
    
    const adminPasswordHash = PasswordUtils.hashPassword('Admin123!');
    
    await pool.query(`
      INSERT INTO users (
        id, organization_id, username, email, password_hash,
        first_name, last_name, roles, permissions, branch_ids, status,
        created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[], $9::text[], $10::uuid[], $11, $12, $13)
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        roles = EXCLUDED.roles,
        permissions = EXCLUDED.permissions,
        status = EXCLUDED.status,
        updated_at = NOW()
    `, [
      FIXED_ADMIN_ID,
      FIXED_ORG_ID,
      'admin',
      'admin@folkcare.example',
      adminPasswordHash,
      'System',
      'Administrator',
      '{SUPER_ADMIN}',
      '{organizations:*,users:*,clients:*,caregivers:*,visits:*,schedules:*,care-plans:*,tasks:*,billing:*,reports:*,settings:*}',
      `{${FIXED_BRANCH_ID}}`,
      'ACTIVE',
      FIXED_ADMIN_ID,
      FIXED_ADMIN_ID,
    ]);

    // ==========================================================================
    // STEP 4: Create family user
    // Password: Family123!
    // ==========================================================================
    console.log('Creating family user...');
    
    const familyPasswordHash = PasswordUtils.hashPassword('Family123!');
    
    await pool.query(`
      INSERT INTO users (
        id, organization_id, username, email, password_hash,
        first_name, last_name, roles, permissions, branch_ids, status,
        created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[], $9::text[], $10::uuid[], $11, $12, $13)
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        roles = EXCLUDED.roles,
        permissions = EXCLUDED.permissions,
        status = EXCLUDED.status,
        updated_at = NOW()
    `, [
      FIXED_FAMILY_ID,
      FIXED_ORG_ID,
      'family',
      'family@folkcare.example',
      familyPasswordHash,
      'Stein',
      'Family',
      '{FAMILY}',
      '{clients:read,visits:read,care-plans:read,tasks:read,schedules:read}',
      `{${FIXED_BRANCH_ID}}`,
      'ACTIVE',
      FIXED_ADMIN_ID,
      FIXED_ADMIN_ID,
    ]);

    console.log('\n✅ Base seed completed successfully!\n');
    console.log('📊 Operational data created:');
    console.log('  Organization: Folk Home Health');
    console.log('  Branch: Main Office');
    console.log('  Admin User: admin@folkcare.example / Admin123!');
    console.log('  Family User: family@folkcare.example / Family123!');
    console.log('\n💡 Run "npm run db:seed:demo" to add comprehensive demo data (clients, caregivers, visits, etc.)\n');
  } catch (error) {
    console.error('❌ Error seeding base data:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedBaseData().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { seedBaseData };
