import type { Knex } from 'knex';

/**
 * Migration for caregiver_availability_overrides table
 * Supports per-week availability overrides for caregivers
 */
export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('caregiver_availability_overrides');
  if (!hasTable) {
    await knex.schema.createTable('caregiver_availability_overrides', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('organization_id').notNullable().references('id').inTable('organizations');
      table.uuid('caregiver_id').notNullable().references('id').inTable('caregivers');
      table.date('week_start').notNullable();
      table.jsonb('schedule').notNullable();
      table.integer('version').notNullable().defaultTo(1);
      table.uuid('created_by');
      table.uuid('updated_by');
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('deleted_at', { useTz: true });
    });

    await knex.raw(
      'CREATE UNIQUE INDEX idx_caregiver_avail_overrides_caregiver_week ON caregiver_availability_overrides(caregiver_id, week_start) WHERE deleted_at IS NULL'
    );

    await knex.raw(
      'CREATE INDEX idx_caregiver_avail_overrides_org_cg ON caregiver_availability_overrides(organization_id, caregiver_id)'
    );
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('caregiver_availability_overrides');
}
