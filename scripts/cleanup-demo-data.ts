#!/usr/bin/env npx tsx
/**
 * Production Demo/Seed Data Cleanup Script (E7 Launch Readiness — wdvf3adf66)
 *
 * Removes demo/seed records (`is_demo_data = true` and `@folkcare.example` seed users)
 * while preserving a designated ops admin account.
 *
 * Usage:
 *   npx tsx scripts/cleanup-demo-data.ts --dry-run
 *   npx tsx scripts/cleanup-demo-data.ts --confirm --preserve-admin ops@agency.com
 */

import { config as dotenvConfig } from 'dotenv';
import { Pool } from 'pg';

dotenvConfig({ path: '.env', quiet: true });

const DEMO_TABLES_IN_DELETE_ORDER = [
  'evv_records',
  'visit_tasks',
  'visit_notes',
  'visits',
  'care_plan_goals',
  'care_plans',
  'invoice_line_items',
  'invoices',
  'payroll_items',
  'payroll_runs',
  'client_caregiver_assignments',
  'family_client_links',
  'clients',
  'caregivers',
] as const;

interface CleanupOptions {
  dryRun: boolean;
  preserveAdminEmail: string;
}

function parseArgs(argv: string[]): CleanupOptions {
  const confirm = argv.includes('--confirm');
  const preserveIdx = argv.indexOf('--preserve-admin');
  const preserveAdminEmail =
    (preserveIdx !== -1 && argv[preserveIdx + 1] ? argv[preserveIdx + 1] : undefined) ??
    process.env['PRESERVE_ADMIN_EMAIL'] ??
    'admin@folkcare.example';

  return {
    dryRun: !confirm,
    preserveAdminEmail: preserveAdminEmail.trim().toLowerCase(),
  };
}

async function tableHasColumn(pool: Pool, table: string, column: string): Promise<boolean> {
  const res = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     ) AS exists`,
    [table, column]
  );
  return res.rows[0]?.exists === true;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env['DATABASE_URL'];

  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL is not set.');
    process.exit(1);
  }

  console.log(`Mode: ${options.dryRun ? 'DRY RUN (no changes will be committed)' : 'EXECUTE (--confirm)'}`);
  console.log(`Preserving admin account: ${options.preserveAdminEmail}`);

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    // Verify the preserved admin account exists before deleting anything
    const adminCheck = await client.query<{ id: string; email: string }>(
      `SELECT id, email FROM users WHERE LOWER(email) = $1 LIMIT 1`,
      [options.preserveAdminEmail]
    );
    if (adminCheck.rows.length === 0) {
      throw new Error(
        `Preserved admin account "${options.preserveAdminEmail}" not found in users table. Aborting to prevent lockout.`
      );
    }

    await client.query('BEGIN');

    const summary: Array<{ table: string; count: number }> = [];

    for (const table of DEMO_TABLES_IN_DELETE_ORDER) {
      const hasDemoFlag = await tableHasColumn(pool, table, 'is_demo_data');
      if (!hasDemoFlag) {
        continue;
      }

      if (options.dryRun) {
        const res = await client.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM "${table}" WHERE is_demo_data = true`
        );
        summary.push({ table, count: Number(res.rows[0]?.count ?? '0') });
      } else {
        const res = await client.query(`DELETE FROM "${table}" WHERE is_demo_data = true`);
        summary.push({ table, count: res.rowCount ?? 0 });
      }
    }

    // Clean up non-preserved demo users (@folkcare.example)
    if (options.dryRun) {
      const res = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM users
         WHERE LOWER(email) LIKE '%@folkcare.example' AND LOWER(email) <> $1`,
        [options.preserveAdminEmail]
      );
      summary.push({ table: 'users (demo)', count: Number(res.rows[0]?.count ?? '0') });
      await client.query('ROLLBACK');
    } else {
      const res = await client.query(
        `DELETE FROM users
         WHERE LOWER(email) LIKE '%@folkcare.example' AND LOWER(email) <> $1`,
        [options.preserveAdminEmail]
      );
      summary.push({ table: 'users (demo)', count: res.rowCount ?? 0 });
      await client.query('COMMIT');
    }

    console.log('\nCleanup Summary:');
    for (const row of summary) {
      console.log(`  ${row.table.padEnd(32)} ${row.count} row(s)`);
    }
    console.log(
      options.dryRun
        ? '\nDry run complete. Re-run with --confirm to execute.'
        : '\nDemo data cleanup committed successfully.'
    );
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Cleanup failed:', err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
