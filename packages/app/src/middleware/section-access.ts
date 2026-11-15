/**
 * Section-based READ/WRITE access guard (ticket wdvf3abzp9, HIPAA minimum necessary).
 *
 * Reads req.userContext (populated by authContextMiddleware), resolves the request
 * to one or more sections via an explicit prefix table, and compares the user's
 * effective section access (role defaults + per-user restrictive overrides).
 *
 * Rollout flag SECTION_ACCESS_ENFORCEMENT:
 *   off     - guard is a no-op
 *   shadow  - (default) would-deny requests are audited as SECTION_ACCESS_WOULD_DENY and allowed
 *   enforce - denials return 403 SECTION_ACCESS_DENIED
 *
 * SUPER_ADMIN is not special: it holds "*:*" so it passes by default, but overrides can
 * still restrict it. The only break-glass rule is that SUPER_ADMIN/ORG_ADMIN can always
 * reach the section-access editing endpoints, so admins cannot lock themselves out of
 * the screen needed to repair access.
 *
 * FAMILY and CLIENT portal roles are exempt (their access is bounded by linked-client
 * checks in the routes themselves).
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import {
  AuditService,
  SectionAccessService,
  getDatabase,
  getPermissionService,
  type Database,
  type Section,
  type SectionAccessLevel,
  type UserContext,
} from '@folkcare/core';

export type EnforcementMode = 'off' | 'shadow' | 'enforce';

export type GuardResolution =
  | { kind: 'exempt' }
  | { kind: 'unmapped' }
  | { kind: 'guard'; sections: Section[]; level: SectionAccessLevel };

/** Prefixes (relative to /api) that are never section-guarded. Order does not matter. */
export const EXEMPT_PREFIXES: readonly string[] = [
  'auth',
  'users/profile',
  'users/password',
  'users/preferences',
  'users/me',
  'health',
  'csrf-token',
  'invitations',
  'signup',
  'push',
  // Non-PHI or self-scoped utility routes
  'demo',
  'sync',
  'usage',
  'verification',
  'verify-email',
  'resend-verification',
  'service-types',
  'validation',
  'ai',
  'ai-usage',
];

/**
 * Prefix -> section table (relative to /api). Longest/most specific entries win,
 * so the visit sub-resources are listed with a regex that is tried first.
 */
export interface PrefixRule {
  readonly prefix: string;
  readonly section: Section;
}

const SPECIFIC_RULES: ReadonlyArray<{ pattern: RegExp; section: Section }> = [
  { pattern: /^visits\/[^/]+\/tasks(\/|$)/, section: 'tasks' },
  { pattern: /^visits\/[^/]+\/notes(\/|$)/, section: 'notes' },
];

export const SECTION_PREFIX_TABLE: readonly PrefixRule[] = [
  { prefix: 'clients', section: 'clients' },
  { prefix: 'branches', section: 'clients' },
  { prefix: 'medications', section: 'clients' },
  { prefix: 'caregivers', section: 'caregivers' },
  { prefix: 'burnout', section: 'caregivers' },
  { prefix: 'staff', section: 'staff' },
  { prefix: 'schedules', section: 'scheduling' },
  { prefix: 'scheduling', section: 'scheduling' },
  { prefix: 'shift-matching', section: 'scheduling' },
  { prefix: 'visits', section: 'visits' },
  { prefix: 'evv', section: 'visits' },
  { prefix: 'time-tracking', section: 'visits' },
  { prefix: 'care-plans', section: 'care-plans' },
  { prefix: 'care-plan-templates', section: 'care-plans' },
  { prefix: 'tasks', section: 'tasks' },
  { prefix: 'task-prioritization', section: 'tasks' },
  { prefix: 'visit-notes', section: 'notes' },
  { prefix: 'progress-notes', section: 'notes' },
  { prefix: 'notes', section: 'notes' },
  { prefix: 'incidents', section: 'incidents' },
  { prefix: 'messages', section: 'messages' },
  { prefix: 'notifications', section: 'messages' },
  { prefix: 'family', section: 'family-portal' },
  { prefix: 'family-portal', section: 'family-portal' },
  { prefix: 'family-engagement', section: 'family-portal' },
  { prefix: 'activity-feed', section: 'family-portal' },
  { prefix: 'billing', section: 'billing' },
  { prefix: 'invoices', section: 'billing' },
  { prefix: 'reports', section: 'reports' },
  { prefix: 'analytics', section: 'reports' },
  { prefix: 'export', section: 'reports' },
  { prefix: 'compliance', section: 'compliance' },
  { prefix: 'audits', section: 'compliance' },
  { prefix: 'qa-audits', section: 'compliance' },
  { prefix: 'audit-logs', section: 'audit-logs' },
  { prefix: 'audit-events', section: 'audit-logs' },
  { prefix: 'admin', section: 'admin-settings' },
  { prefix: 'settings', section: 'admin-settings' },
  { prefix: 'organizations', section: 'admin-settings' },
  { prefix: 'white-label', section: 'admin-settings' },
  { prefix: 'onboarding', section: 'admin-settings' },
  { prefix: 'users', section: 'admin-settings' },
  { prefix: 'training', section: 'training-payroll' },
  { prefix: 'certifications', section: 'training-payroll' },
  { prefix: 'payroll', section: 'training-payroll' },
  { prefix: 'search', section: 'clients' },
  { prefix: 'import', section: 'admin-settings' },
];

/** Entity names accepted by /api/import/:entity and /api/search?type= mapped to sections. */
const ENTITY_SECTIONS: ReadonlyMap<string, Section> = new Map<string, Section>([
  ['clients', 'clients'],
  ['caregivers', 'caregivers'],
  ['visits', 'visits'],
  ['care_plans', 'care-plans'],
  ['care-plans', 'care-plans'],
  ['organizations', 'admin-settings'],
  ['users', 'staff'],
]);

/** `type=all` search fans out across these entities, so all must be readable. */
const SEARCH_ALL_SECTIONS: readonly Section[] = ['clients', 'caregivers', 'visits', 'care-plans'];

/** POSTs that are read-only despite their method. */
const READ_ONLY_POST_PATTERNS: readonly RegExp[] = [
  /^medications\/check-interactions$/,
  /^search(\/|$)/,
  /\/search$/,
];

const SECTION_ACCESS_EDIT_PATH = /^organizations\/[^/]+\/users\/[^/]+\/section-access$/;
const BREAK_GLASS_ROLES: readonly string[] = ['SUPER_ADMIN', 'ORG_ADMIN'];
const EXEMPT_ROLES: readonly string[] = ['FAMILY', 'CLIENT'];

let cachedDatabase: Database | undefined;

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/** Strip query, leading /api, surrounding slashes. */
export function normalizeApiPath(url: string): string {
  const withoutQuery = url.split('?')[0] ?? '';
  const withoutApi = withoutQuery.startsWith('/api') ? withoutQuery.slice(4) : withoutQuery;
  let start = 0;
  let end = withoutApi.length;
  while (start < end && withoutApi.charCodeAt(start) === 47) {
    start += 1;
  }
  while (end > start && withoutApi.charCodeAt(end - 1) === 47) {
    end -= 1;
  }
  return withoutApi.slice(start, end).toLowerCase();
}

function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

function resolveEntityRoute(
  path: string,
  query: Request['query'],
  level: SectionAccessLevel
): GuardResolution | null {
  if (matchesPrefix(path, 'search')) {
    const type = firstQueryValue(query['type']) ?? 'all';
    if (type === 'all') {
      return { kind: 'guard', sections: [...SEARCH_ALL_SECTIONS], level: 'READ' };
    }
    const section = ENTITY_SECTIONS.get(type);
    return {
      kind: 'guard',
      sections: section === undefined ? [...SEARCH_ALL_SECTIONS] : [section],
      level: 'READ',
    };
  }
  if (matchesPrefix(path, 'import')) {
    const entity = path.split('/')[1] ?? '';
    const section = ENTITY_SECTIONS.get(entity);
    return {
      kind: 'guard',
      sections: section === undefined ? ['admin-settings'] : [section],
      level,
    };
  }
  return null;
}

function resolvePrefixTable(path: string, level: SectionAccessLevel): GuardResolution {
  for (const rule of SPECIFIC_RULES) {
    if (rule.pattern.test(path)) {
      return { kind: 'guard', sections: [rule.section], level };
    }
  }
  for (const rule of SECTION_PREFIX_TABLE) {
    if (matchesPrefix(path, rule.prefix)) {
      return { kind: 'guard', sections: [rule.section], level };
    }
  }
  return { kind: 'unmapped' };
}

/** Pure resolver: which sections/level does this request need? */
export function resolveRequest(
  method: string,
  url: string,
  query: Request['query'] = {}
): GuardResolution {
  const path = normalizeApiPath(url);
  const upperMethod = method.toUpperCase();
  let level: SectionAccessLevel = SectionAccessService.methodToLevel(upperMethod);
  if (
    level === 'WRITE' &&
    upperMethod === 'POST' &&
    READ_ONLY_POST_PATTERNS.some((p) => p.test(path))
  ) {
    level = 'READ';
  }

  if (EXEMPT_PREFIXES.some((p) => matchesPrefix(path, p))) {
    return { kind: 'exempt' };
  }

  const entityResolution = resolveEntityRoute(path, query, level);
  if (entityResolution !== null) {
    return entityResolution;
  }

  return resolvePrefixTable(path, level);
}

export function getEnforcementMode(): EnforcementMode {
  const raw = process.env['SECTION_ACCESS_ENFORCEMENT']?.trim().toLowerCase();
  if (raw === 'off' || raw === 'enforce' || raw === 'shadow') return raw;
  return 'shadow';
}

function isExemptRoleSet(ctx: UserContext): boolean {
  return ctx.roles.length > 0 && ctx.roles.every((r) => EXEMPT_ROLES.includes(r));
}

interface GuardRequest {
  sections: readonly Section[];
  level: SectionAccessLevel;
}

function extractGuardTarget(resolved: GuardResolution | GuardRequest): GuardRequest | null {
  if ('kind' in resolved) {
    if (resolved.kind !== 'guard') {
      return null;
    }
    return { sections: resolved.sections, level: resolved.level };
  }
  return resolved;
}

function createGuard(
  db: Database,
  resolve: (req: Request) => GuardResolution | GuardRequest
): RequestHandler {
  const audit = new AuditService(db);
  const service = new SectionAccessService(db, audit, getPermissionService());

  const logDecision = async (
    req: Request,
    ctx: UserContext,
    action: string,
    denied: Section,
    level: SectionAccessLevel
  ): Promise<void> => {
    try {
      await audit.logEvent(ctx, {
        eventType: 'AUTHORIZATION',
        resource: req.originalUrl.split('?')[0] ?? req.path,
        resourceId: ctx.userId,
        action,
        result: 'FAILURE',
        metadata: {
          section: denied,
          required: level,
          method: req.method,
          enforcement: getEnforcementMode(),
        },
        ipAddress: req.ip ?? req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });
    } catch (error: unknown) {
      console.error('Failed to log section access decision:', error);
    }
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    void (async (): Promise<void> => {
      const mode = getEnforcementMode();
      const ctx = req.userContext;
      if (mode === 'off' || ctx === undefined || isExemptRoleSet(ctx)) {
        next();
        return;
      }

      const target = extractGuardTarget(resolve(req));
      if (target === null) {
        next();
        return;
      }

      const path = normalizeApiPath(req.originalUrl);
      if (
        SECTION_ACCESS_EDIT_PATH.test(path) &&
        ctx.roles.some((r) => BREAK_GLASS_ROLES.includes(r))
      ) {
        next();
        return;
      }

      let denied: Section | undefined;
      try {
        const { effective } = await service.getEffective(ctx);
        const effectiveMap = new Map(Object.entries(effective));
        denied = target.sections.find((s) => {
          const flags = effectiveMap.get(s) ?? { read: false, write: false };
          return !SectionAccessService.accessAllows(flags, target.level);
        });
      } catch (error: unknown) {
        console.error('Section access evaluation failed:', error);
        if (mode === 'enforce') {
          res.status(500).json({
            success: false,
            error: 'Access evaluation failed',
            code: 'SECTION_ACCESS_ERROR',
          });
          return;
        }
        next();
        return;
      }

      if (denied === undefined) {
        next();
        return;
      }

      if (mode === 'shadow') {
        await logDecision(req, ctx, 'SECTION_ACCESS_WOULD_DENY', denied, target.level);
        next();
        return;
      }

      await logDecision(req, ctx, 'SECTION_ACCESS_DENIED', denied, target.level);
      res.status(403).json({
        success: false,
        error: `Access to the ${denied} section is not permitted for this user`,
        code: 'SECTION_ACCESS_DENIED',
        section: denied,
        required: target.level,
      });
    })();
  };
}

/**
 * Explicit per-route guard: `requireSection('clients', 'READ')`.
 */
export function requireSection(
  section: Section,
  level: SectionAccessLevel,
  db?: Database
): RequestHandler {
  const resolvedDb = db ?? cachedDatabase ?? getDatabase();
  return createGuard(resolvedDb, () => ({ sections: [section], level }));
}

/** Global guard driven by the prefix table; mount on /api before the routers. */
export function sectionAccessMiddleware(db: Database): RequestHandler {
  cachedDatabase = db;
  return createGuard(db, (req) => resolveRequest(req.method, req.originalUrl, req.query));
}
