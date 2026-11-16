import type { Knex } from 'knex';

const INTAKE_JSONB_COLUMNS = [
  'authorization_info',
  'assessment_data',
  'care_plan_summary',
  'visit_schedule',
  'caregiver_assignment',
] as const;

export async function up(knex: Knex): Promise<void> {
  for (const col of INTAKE_JSONB_COLUMNS) {
    const hasCol = await knex.schema.hasColumn('clients', col);
    if (!hasCol) {
      await knex.schema.alterTable('clients', (table) => {
        table.jsonb(col).nullable();
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  for (const col of [...INTAKE_JSONB_COLUMNS].reverse()) {
    const hasCol = await knex.schema.hasColumn('clients', col);
    if (hasCol) {
      await knex.schema.alterTable('clients', (table) => {
        table.dropColumn(col);
      });
    }
  }
}
