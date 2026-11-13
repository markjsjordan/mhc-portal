/**
 * Portal Link Resolver
 *
 * Resolves active caregiver and family portal links for a given user.
 * Derives dynamic CAREGIVER and FAMILY roles from ACTIVE links.
 */

import { Database } from '../db/connection.js';
import { UUID } from '../types/base.js';

export interface ResolvedPortalLinks {
  caregiverId?: UUID;
  familyMemberIds: UUID[];
  familyClientIds: UUID[];
  directClientId?: UUID; // Direct client portal access (CLIENT role)
}

/**
 * Resolves active portal links for a user from database.
 * - caregiverId: caregivers.user_id = $1 AND portal_access_status = 'ACTIVE' AND deleted_at IS NULL
 * - family: family_members.user_id = $1 AND portal_access_status = 'ACTIVE', joined to clients whose status is NOT IN ('DISCHARGED', 'DECEASED')
 * - directClientId: clients.user_id = $1 AND portal_access_status = 'ACTIVE' AND status NOT IN ('DISCHARGED', 'DECEASED')
 */
export async function resolvePortalLinks(
  db: Database,
  userId: UUID
): Promise<ResolvedPortalLinks> {
  const [caregiverRes, familyRes, clientRes] = await Promise.all([
    db.query<{ id: string }>(
      `SELECT id
       FROM caregivers
       WHERE user_id = $1
         AND portal_access_status = 'ACTIVE'
         AND deleted_at IS NULL
       LIMIT 1`,
      [userId]
    ),
    db.query<{ id: string; client_id: string }>(
      `SELECT fm.id, fm.client_id
       FROM family_members fm
       JOIN clients c ON c.id = fm.client_id
       WHERE fm.user_id = $1
         AND fm.portal_access_status = 'ACTIVE'
         AND (c.status IS NULL OR c.status NOT IN ('DISCHARGED', 'DECEASED'))`,
      [userId]
    ),
    db.query<{ id: string }>(
      `SELECT id
       FROM clients
       WHERE user_id = $1
         AND portal_access_status = 'ACTIVE'
         AND deleted_at IS NULL
         AND (status IS NULL OR status NOT IN ('DISCHARGED', 'DECEASED'))
       LIMIT 1`,
      [userId]
    ),
  ]);

  const caregiverId = caregiverRes.rows[0]?.id;
  const directClientId = clientRes.rows[0]?.id;
  const familyMemberIds: UUID[] = familyRes.rows.map((r) => r.id);
  const familyClientIds: UUID[] = Array.from(
    new Set(familyRes.rows.map((r) => r.client_id).filter((cid) => Boolean(cid)))
  );

  const links: ResolvedPortalLinks = {
    familyMemberIds,
    familyClientIds,
  };

  if (caregiverId !== undefined && caregiverId !== '') {
    links.caregiverId = caregiverId;
  }

  if (directClientId !== undefined && directClientId !== '') {
    links.directClientId = directClientId;
  }

  return links;
}

/**
 * Derives effective roles from staff roles and resolved portal links:
 * - Drops 'CAREGIVER', 'FAMILY', and 'CLIENT' from users.roles
 * - Adds 'CAREGIVER' if caregiverId is set
 * - Adds 'FAMILY' if familyMemberIds is non-empty
 * - Adds 'CLIENT' if directClientId is set
 */
export function deriveRoles(
  staffRoles: string[] = [],
  links: ResolvedPortalLinks
): string[] {
  const filteredRoles = staffRoles.filter(
    (role) => role !== 'CAREGIVER' && role !== 'FAMILY' && role !== 'CLIENT'
  );

  if (links.caregiverId !== undefined && links.caregiverId !== '' && !filteredRoles.includes('CAREGIVER')) {
    filteredRoles.push('CAREGIVER');
  }

  if (links.familyMemberIds.length > 0 && !filteredRoles.includes('FAMILY')) {
    filteredRoles.push('FAMILY');
  }

  if (links.directClientId !== undefined && links.directClientId !== '' && !filteredRoles.includes('CLIENT')) {
    filteredRoles.push('CLIENT');
  }

  return filteredRoles;
}

/** Roles that are derived from ACTIVE portal links and must never be written to users.roles directly. */
export const PORTAL_DERIVED_ROLES = ['CAREGIVER', 'FAMILY'] as const;

export const PORTAL_DERIVED_ROLE_MESSAGE =
  'CAREGIVER and FAMILY are granted by an ACTIVE portal link, not assigned as a team role. ' +
  'Use "Caregivers > Invite to portal" (or the family/client portal invite) instead.';

/** Returns the portal-derived roles found in a role list (case-insensitive). */
export function findPortalDerivedRoles(roles: readonly string[] | undefined): string[] {
  return (roles ?? []).filter((r) =>
    (PORTAL_DERIVED_ROLES as readonly string[]).includes(String(r).toUpperCase())
  );
}
