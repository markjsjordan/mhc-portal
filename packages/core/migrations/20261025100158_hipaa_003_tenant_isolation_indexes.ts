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
    
    // Check if index already exists
    const hasIndex = await knex.schema.hasTable(table);
    if (!hasIndex) {
      console.log(`Skipping ${table} - table does not exist`);
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
    
    const hasTable = await knex.schema.hasTable(table);
    if (!hasTable) {
      continue;
    }

    await knex.schema.alterTable(table, (t) => {
      t.dropIndex(['id', 'organization_id', 'deleted_at'], indexName);
    });

    console.log(`Dropped index ${indexName} from ${table}`);
  }

  console.log('HIPAA-003 tenant isolation indexes removed');
}
