/**
 * HIPAA-003: Add tenant isolation indexes
 * 
 * Creates composite indexes to optimize tenant isolation validation queries
 */

import { Knex } from 'knex';

const TABLES = [
  'clients',
  'caregivers',
  'visits',
  'schedules',
  'staff',
  'users',
  'branches',
  'invoices',
  'payments',
  'documents',
  'notes',
  'assessments',
  'care_plans',
  'tasks',
  'medications',
  'emergency_contacts',
  'authorizations',
  'lab_results',
  'vital_signs',
];

export async function up(knex: Knex): Promise<void> {
  for (const table of TABLES) {
    const indexName = `idx_${table}_tenant_isolation`;
    
    // Skip tables that are absent OR lack the columns the index needs.
    // Not every listed table has deleted_at (e.g. schedules) — indexing a
    // missing column aborts the whole migration on a fresh database.
    const hasTable = await knex.schema.hasTable(table);
    if (!hasTable) {
      console.log(`Skipping ${table} - table does not exist`);
      continue;
    }
    const hasColumns =
      (await knex.schema.hasColumn(table, 'id')) &&
      (await knex.schema.hasColumn(table, 'organization_id')) &&
      (await knex.schema.hasColumn(table, 'deleted_at'));
    if (!hasColumns) {
      console.log(`Skipping ${table} - missing id/organization_id/deleted_at`);
      continue;
    }

    // Create composite index on (id, organization_id, deleted_at)
    await knex.schema.alterTable(table, (t) => {
      t.index(['id', 'organization_id', 'deleted_at'], indexName);
    });

    console.log(`Created index ${indexName} on ${table}`);
  }

  console.log('HIPAA-003 tenant isolation indexes created');
}

export async function down(knex: Knex): Promise<void> {
  for (const table of TABLES) {
    const indexName = `idx_${table}_tenant_isolation`;
    
    // Mirror up(): only drop indexes that up() actually created.
    const hasTable = await knex.schema.hasTable(table);
    if (!hasTable) {
      continue;
    }
    const hasColumns =
      (await knex.schema.hasColumn(table, 'id')) &&
      (await knex.schema.hasColumn(table, 'organization_id')) &&
      (await knex.schema.hasColumn(table, 'deleted_at'));
    if (!hasColumns) {
      continue;
    }

    await knex.schema.alterTable(table, (t) => {
      t.dropIndex(['id', 'organization_id', 'deleted_at'], indexName);
    });

    console.log(`Dropped index ${indexName} from ${table}`);
  }

  console.log('HIPAA-003 tenant isolation indexes removed');
}
