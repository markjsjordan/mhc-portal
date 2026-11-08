import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('user_section_access', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table
      .uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .uuid('organization_id')
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table.string('section', 50).notNullable();
    table.string('access', 10).notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table
      .uuid('created_by')
      .notNullable()
      .references('id')
      .inTable('users');
    table
      .uuid('updated_by')
      .notNullable()
      .references('id')
      .inTable('users');

    table.check(
      `access IN ('READ','WRITE','NONE')`,
      [],
      'chk_user_section_access_access'
    );
    table.unique(['user_id', 'section'], {
      indexName: 'uq_user_section_access_user_section',
    });
  });

  await knex.raw(
    'CREATE INDEX idx_user_section_access_org ON user_section_access(organization_id)'
  );

  await knex.raw(`
    CREATE TRIGGER update_user_section_access_updated_at
    BEFORE UPDATE ON user_section_access
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(
    'DROP TRIGGER IF EXISTS update_user_section_access_updated_at ON user_section_access'
  );
  await knex.schema.dropTableIfExists('user_section_access');
}
