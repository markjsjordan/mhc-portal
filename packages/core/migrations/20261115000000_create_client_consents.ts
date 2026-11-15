import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('client_consents', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table
      .uuid('client_id')
      .notNullable()
      .references('id')
      .inTable('clients')
      .onDelete('CASCADE');
    table
      .uuid('organization_id')
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table.boolean('care_agreement').notNullable().defaultTo(false);
    table.boolean('hipaa').notNullable().defaultTo(false);
    table.boolean('financial_responsibility').notNullable().defaultTo(false);
    table.boolean('evv').notNullable().defaultTo(false);
    table.text('signature').notNullable().defaultTo('');
    table.string('signed_date', 32).notNullable().defaultTo('');
    table.uuid('recorded_by').nullable().references('id').inTable('users');
    table.timestamp('recorded_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique(['client_id'], {
      indexName: 'uq_client_consents_client_id',
    });
  });

  await knex.raw(
    'CREATE INDEX idx_client_consents_org ON client_consents(organization_id)'
  );

  await knex.raw(`
    CREATE TRIGGER update_client_consents_updated_at
    BEFORE UPDATE ON client_consents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(
    'DROP TRIGGER IF EXISTS update_client_consents_updated_at ON client_consents'
  );
  await knex.schema.dropTableIfExists('client_consents');
}
