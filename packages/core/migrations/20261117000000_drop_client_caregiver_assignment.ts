import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasCol = await knex.schema.hasColumn('clients', 'caregiver_assignment');
  if (hasCol) {
    await knex.schema.alterTable('clients', (table) => {
      table.dropColumn('caregiver_assignment');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasCol = await knex.schema.hasColumn('clients', 'caregiver_assignment');
  if (!hasCol) {
    await knex.schema.alterTable('clients', (table) => {
      table.jsonb('caregiver_assignment').nullable();
    });
  }
}
