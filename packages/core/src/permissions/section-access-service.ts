/**
 * SectionAccessService
 *
 * Implements section-based READ/WRITE access control (ticket wdvf3abzp9).
 * Combines role-based defaults with user-specific database overrides.
 */

import type { Database } from '../db/connection.js';
import type { AuditService } from '../audit/audit-service.js';
import type { PermissionService } from './permission-service.js';
import {
  SECTIONS,
  type Section,
  type SectionPermission,
  type SectionPermissionMap,
  legacyToSectionMap,
} from './section-access.js';
import {
  type UserContext,
  type UUID,
  ValidationError,
  NotFoundError,
} from '../types/base.js';

export type SectionAccessLevel = 'READ' | 'WRITE';
export type SectionAccessOverride = 'READ' | 'WRITE' | 'NONE';

export interface SectionAccessOverrides {
  [section: string]: SectionAccessOverride;
}

export interface EffectiveSectionAccess {
  roleDefaults: SectionPermissionMap;
  overrides: Array<{ section: Section; access: SectionAccessOverride }>;
  effective: SectionPermissionMap;
}

interface UserSectionAccessRow extends Record<string, unknown> {
  id: string;
  user_id: string;
  organization_id: string;
  section: string;
  access: SectionAccessOverride;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  updated_by: string;
}

interface TargetUserRow extends Record<string, unknown> {
  id: string;
  organization_id: string;
  deleted_at: Date | null;
}

const SPECIFIC_PATH_MAP: ReadonlyArray<{ pattern: RegExp; section: Section }> = [
  { pattern: /^\/api\/visits\/[^/]+\/tasks(\/|$)/, section: 'tasks' },
  { pattern: /^\/api\/visits\/[^/]+\/notes(\/|$)/, section: 'notes' },
];

const PREFIX_SECTION_MAP: ReadonlyArray<{ pattern: RegExp; section: Section }> = [
  { pattern: /^\/api\/(clients|branches)(\/|$)/, section: 'clients' },
  { pattern: /^\/api\/caregivers(\/|$)/, section: 'caregivers' },
  { pattern: /^\/api\/staff(\/|$)/, section: 'staff' },
  { pattern: /^\/api\/(schedules|shift-matching)(\/|$)/, section: 'scheduling' },
  { pattern: /^\/api\/(visits|evv|time-tracking)(\/|$)/, section: 'visits' },
  { pattern: /^\/api\/(care-plans|care-plan-templates)(\/|$)/, section: 'care-plans' },
  { pattern: /^\/api\/(tasks|task-prioritization)(\/|$)/, section: 'tasks' },
  { pattern: /^\/api\/(visit-notes|notes)(\/|$)/, section: 'notes' },
  { pattern: /^\/api\/incidents(\/|$)/, section: 'incidents' },
  { pattern: /^\/api\/(messages|notifications)(\/|$)/, section: 'messages' },
  { pattern: /^\/api\/(family|family-portal|activity-feed)(\/|$)/, section: 'family-portal' },
  { pattern: /^\/api\/(billing|invoices)(\/|$)/, section: 'billing' },
  { pattern: /^\/api\/(reports|analytics|export)(\/|$)/, section: 'reports' },
  { pattern: /^\/api\/(compliance|qa-audits)(\/|$)/, section: 'compliance' },
  { pattern: /^\/api\/(audit|audit-logs)(\/|$)/, section: 'audit-logs' },
  { pattern: /^\/api\/(admin|settings|organizations|white-label|onboarding)(\/|$)/, section: 'admin-settings' },
  { pattern: /^\/api\/(training|certifications|payroll)(\/|$)/, section: 'training-payroll' },
  { pattern: /^\/api\/medications(\/|$)/, section: 'clients' },
];

export class SectionAccessService {
  constructor(
    private readonly db: Database,
    private readonly audit: AuditService,
    private readonly perms: PermissionService
  ) {}

  /**
   * Determine the role-default section permission map for a user context.
   */
  getRoleDefaults(ctx: UserContext): SectionPermissionMap {
    const rolePermissions = this.perms.getPermissionsForRoles(ctx.roles);
    const combined = [...ctx.permissions, ...rolePermissions];
    return legacyToSectionMap(combined).map;
  }

  /**
   * Retrieve all section access overrides for a user in an organization.
   */
  async getOverrides(orgId: UUID, userId: UUID): Promise<Map<Section, SectionAccessOverride>> {
    const query = `
      SELECT section, access
      FROM user_section_access
      WHERE organization_id = $1 AND user_id = $2
    `;
    const result = await this.db.query<UserSectionAccessRow>(query, [orgId, userId]);
    const overrides = new Map<Section, SectionAccessOverride>();
    for (const row of result.rows) {
      overrides.set(row.section as Section, row.access);
    }
    return overrides;
  }

  /**
   * Calculate effective section permissions combining defaults and overrides.
   */
  async getEffective(ctx: UserContext): Promise<EffectiveSectionAccess> {
    const roleDefaults = this.getRoleDefaults(ctx);
    const hasOrg = typeof ctx.organizationId === 'string' && ctx.organizationId.length > 0;
    const overridesMap = hasOrg
      ? await this.getOverrides(ctx.organizationId ?? '', ctx.userId)
      : new Map<Section, SectionAccessOverride>();

    const defaultsMap = new Map<string, SectionPermission>(Object.entries(roleDefaults));
    const effectiveEntries: Array<[Section, SectionPermission]> = [];
    const overrideList: Array<{ section: Section; access: SectionAccessOverride }> = [];

    for (const section of SECTIONS) {
      const override = overridesMap.get(section);
      if (override !== undefined) {
        overrideList.push({ section, access: override });
      }
      if (override === 'NONE') {
        effectiveEntries.push([section, { read: false, write: false }]);
      } else if (override === 'READ') {
        effectiveEntries.push([section, { read: true, write: false }]);
      } else if (override === 'WRITE') {
        effectiveEntries.push([section, { read: true, write: true }]);
      } else {
        effectiveEntries.push([
          section,
          defaultsMap.get(section) ?? { read: false, write: false },
        ]);
      }
    }

    return {
      roleDefaults,
      overrides: overrideList,
      effective: Object.fromEntries(effectiveEntries) as Record<Section, SectionPermission>,
    };
  }

  /**
   * Set or clear a section override for a user in the actor's organization.
   */
  async setOverride(
    actorCtx: UserContext,
    targetUserId: UUID,
    section: string,
    access: SectionAccessOverride | null
  ): Promise<void> {
    if (!SECTIONS.includes(section as Section)) {
      throw new ValidationError(`Invalid section: ${section}`);
    }

    if (typeof actorCtx.organizationId !== 'string' || actorCtx.organizationId.length === 0) {
      throw new ValidationError('Actor has no organization context');
    }

    // Verify target exists in actor's organization and is not deleted
    const userQuery = `
      SELECT id, organization_id, deleted_at
      FROM users
      WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
    `;
    const userResult = await this.db.query<TargetUserRow>(userQuery, [
      targetUserId,
      actorCtx.organizationId,
    ]);

    if (userResult.rows.length === 0) {
      throw new NotFoundError(`User ${targetUserId} not found in organization ${actorCtx.organizationId}`);
    }

    // Query existing override for audit metadata
    const existingQuery = `
      SELECT access
      FROM user_section_access
      WHERE organization_id = $1 AND user_id = $2 AND section = $3
    `;
    const existingResult = await this.db.query<UserSectionAccessRow>(existingQuery, [
      actorCtx.organizationId,
      targetUserId,
      section,
    ]);
    const previous = existingResult.rows[0]?.access ?? null;

    await this.db.transaction(async (client) => {
      if (access === null) {
        // Delete override row
        await client.query(
          `DELETE FROM user_section_access WHERE organization_id = $1 AND user_id = $2 AND section = $3`,
          [actorCtx.organizationId, targetUserId, section]
        );
      } else {
        // Upsert override
        const upsertQuery = `
          INSERT INTO user_section_access (
            user_id, organization_id, section, access, created_by, updated_by
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (user_id, section)
          DO UPDATE SET
            access = EXCLUDED.access,
            updated_by = EXCLUDED.updated_by,
            updated_at = NOW()
        `;
        await client.query(upsertQuery, [
          targetUserId,
          actorCtx.organizationId,
          section,
          access,
          actorCtx.userId,
          actorCtx.userId,
        ]);
      }

      // Audit event
      const action = access === null ? 'SECTION_ACCESS_CLEARED' : 'SECTION_ACCESS_SET';
      await this.audit.logEvent(actorCtx, {
        eventType: 'AUTHORIZATION',
        resource: 'user_section_access',
        resourceId: targetUserId,
        action,
        result: 'SUCCESS',
        metadata: {
          section,
          previous,
          next: access,
        },
      });
    });
  }

  /**
   * Helper: Map an HTTP method to required SectionAccessLevel.
   * GET, HEAD, OPTIONS are READ; everything else is WRITE.
   */
  methodToLevel(method: string): SectionAccessLevel {
    return SectionAccessService.methodToLevel(method);
  }

  static methodToLevel(method: string): SectionAccessLevel {
    const m = method.toUpperCase();
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') {
      return 'READ';
    }
    return 'WRITE';
  }

  /**
   * Helper: Check if section flags allow the requested level.
   */
  accessAllows(flags: SectionPermission, level: SectionAccessLevel): boolean {
    return SectionAccessService.accessAllows(flags, level);
  }

  static accessAllows(flags: SectionPermission, level: SectionAccessLevel): boolean {
    if (level === 'READ') {
      return flags.read;
    }
    return flags.write;
  }

  /**
   * Helper: Pure route-to-section resolution.
   */
  pathToSection(path: string, method?: string): Section | null {
    return SectionAccessService.pathToSection(path, method);
  }

  static pathToSection(path: string, _method?: string): Section | null {
    const cleanPath = path.split('?')[0] ?? '';
    let apiPath = cleanPath;
    if (!cleanPath.startsWith('/api')) {
      apiPath = cleanPath.startsWith('/') ? `/api${cleanPath}` : `/api/${cleanPath}`;
    }

    for (const item of SPECIFIC_PATH_MAP) {
      if (item.pattern.test(apiPath)) {
        return item.section;
      }
    }

    for (const item of PREFIX_SECTION_MAP) {
      if (item.pattern.test(apiPath)) {
        return item.section;
      }
    }

    return null;
  }
}
