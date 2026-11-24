#!/usr/bin/env npx tsx
/**
 * Launch Readiness Performance Baseline Script (E7 — wdvf3adf66)
 *
 * Verifies MVP performance baselines against the target database:
 *   - Audit log query (1-year window): < 500ms
 *   - Visit list query (paginated 50): < 200ms
 *
 * Usage:
 *   npx tsx scripts/benchmark-launch-baseline.ts
 */

import { config as dotenvConfig } from 'dotenv';
import { Pool } from 'pg';

dotenvConfig({ path: '.env', quiet: true });

const AUDIT_LOG_BUDGET_MS = 500;
const VISIT_LIST_BUDGET_MS = 200;

async function measureQuery(
  pool: Pool,
  label: string,
  sql: string,
  params: unknown[],
  budgetMs: number
): Promise<boolean> {
  const start = performance.now();
  const result = await pool.query(sql, params);
  const elapsedMs = performance.now() - start;
  const passed = elapsedMs < budgetMs;
  const status = passed ? 'PASS' : 'FAIL';
  console.log(
    `[${status}] ${label}: ${elapsedMs.toFixed(1)}ms (budget < ${budgetMs}ms, rows=${result.rowCount ?? 0})`
  );
  return passed;
}

async function main(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL is not set.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

    const auditOk = await measureQuery(
      pool,
      'Audit log query (1-year window, limit 100)',
      `SELECT id, action, resource_type, resource_id, created_at
       FROM audit_logs
       WHERE created_at >= $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [oneYearAgo],
      AUDIT_LOG_BUDGET_MS
    );

    const visitsOk = await measureQuery(
      pool,
      'Visit list query (limit 50)',
      `SELECT id, client_id, caregiver_id, status, scheduled_start_time, scheduled_end_time
       FROM visits
       ORDER BY scheduled_start_time DESC
       LIMIT 50`,
      [],
      VISIT_LIST_BUDGET_MS
    );

    if (!auditOk || !visitsOk) {
      console.error('\nPerformance baseline FAILED.');
      process.exitCode = 1;
    } else {
      console.log('\nAll performance baselines PASSED.');
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
