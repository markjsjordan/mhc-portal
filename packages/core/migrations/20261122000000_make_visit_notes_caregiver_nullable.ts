/**
 * Migration: Make visit_notes.caregiver_id nullable
 *
 * Allows coordinators, supervisors, and administrators to leave notes on
 * unassigned visits as well as assigned visits.
 */

import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE visit_notes ALTER COLUMN caregiver_id DROP NOT NULL');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE visit_notes ALTER COLUMN caregiver_id SET NOT NULL');
}
