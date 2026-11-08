/**
 * Section-based access control sections (ticket wdvf3abzp9).
 * Web copy of core SECTIONS.
 */

export const SECTIONS = [
  'clients',
  'caregivers',
  'staff',
  'scheduling',
  'visits',
  'care-plans',
  'tasks',
  'notes',
  'incidents',
  'messages',
  'family-portal',
  'billing',
  'reports',
  'compliance',
  'audit-logs',
  'admin-settings',
  'training-payroll',
] as const;

export type Section = (typeof SECTIONS)[number];
