import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    UPDATE organizations
    SET settings = jsonb_set(coalesce(settings, '{}'), '{evv,locationRequired}', 'false', true)
    WHERE settings #> '{evv,locationRequired}' IS NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    UPDATE organizations
    SET settings = settings #- '{evv,locationRequired}'
    WHERE settings #> '{evv,locationRequired}' IS NOT NULL;
  `);
}
