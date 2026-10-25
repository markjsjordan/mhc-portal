/**
 * Migration: Seed Base Operational Data
 * 
 * ⚠️  DEPRECATED: This migration previously seeded operational data (org, branch, users).
 * As of 2026-01-25, seeding has been moved to packages/core/scripts/seed-base.ts
 * to prevent test users from being inserted into production on every deploy.
 * 
 * This migration is now a no-op to maintain migration history continuity.
 * The actual schema DDL operations originally in this file have been superseded
 * by later migrations.
 * 
 * For base data seeding (dev/preview only), use:
 *   npm run db:seed:base
 * 
 * See: https://app.clickup.com/t/wdvf3ac2zk (Oct 2026 production incident)
 */

import type { Knex } from 'knex';

export async function up(_knex: Knex): Promise<void> {
  console.log('⏭️  Migration 20251121000000_seed_base_data: no-op (seeding moved to scripts/seed-base.ts)\n');
  // No operations - this migration is now a no-op
}

export async function down(_knex: Knex): Promise<void> {
  console.log('⏭️  Rollback 20251121000000_seed_base_data: no-op\n');
  // No operations - this migration is now a no-op
}
