/**
 * Migration: Create schedule_snapshots table
 *
 * Stores periodic and on-demand weekly schedule backups for offline
 * resilience and business continuity during extended system outages.
 */

import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('schedule_snapshots');
  if (!exists) {
    await knex.schema.createTable('schedule_snapshots', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table
        .uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE');
      table.date('week_start_date').notNullable();
      table.date('week_end_date').notNullable();
      table.string('trigger_type', 32).notNullable().defaultTo('MANUAL');
      table.string('label', 255).nullable();
      table.integer('visit_count').notNullable().defaultTo(0);
      table.jsonb('snapshot_data').notNullable().defaultTo('[]');
      table
        .uuid('created_by')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL');
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

      table.index(['organization_id', 'created_at'], 'idx_schedule_snapshots_org_created');
      table.index(['organization_id', 'week_start_date'], 'idx_schedule_snapshots_org_week');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('schedule_snapshots');
}
