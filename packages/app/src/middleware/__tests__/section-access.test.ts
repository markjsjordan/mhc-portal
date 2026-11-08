import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import {
  AuditService,
  Database,
  type UserContext,
} from '@folkcare/core';
import {
  EXEMPT_PREFIXES,
  SECTION_PREFIX_TABLE,
  requireSection,
  resolveRequest,
  sectionAccessMiddleware,
} from '../section-access.js';

const ORG_ID = '22222222-2222-2222-2222-222222222222';
const USER_ID = '11111111-1111-1111-1111-111111111111';

function createTestDatabase(): Database {
  return new Database({
    host: 'localhost',
    port: 5432,
    database: 'test',
    user: 'test',
    password: process.env['TEST_DB_PASSWORD'] ?? '',
  });
}

function buildApp(
  db: Database,
  userContext?: UserContext
): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (userContext !== undefined) {
      req.userContext = userContext;
    }
    next();
  });
  app.use('/api', sectionAccessMiddleware(db));

  const ok = (_req: Request, res: Response): void => {
    res.status(200).json({ ok: true });
  };

  app.get('/api/clients', ok);
  app.post('/api/clients', ok);
  app.put('/api/clients/:id', ok);
  app.patch('/api/clients/:id', ok);
  app.delete('/api/clients/:id', ok);
  app.get('/api/visits/:id/tasks', ok);
  app.post('/api/visits/:id/tasks', ok);
  app.get('/api/auth/me', ok);
  app.post('/api/medications/check-interactions', ok);
  app.post('/api/medications', ok);
  app.get('/api/explicit-billing', requireSection('billing', 'WRITE', db), ok);

  return app;
}

describe('sectionAccessMiddleware & requireSection', () => {
  let db: Database;
  const originalEnforcement = process.env['SECTION_ACCESS_ENFORCEMENT'];

  beforeEach(() => {
    process.env['SECTION_ACCESS_ENFORCEMENT'] = 'enforce';
    db = createTestDatabase();
  });

  afterEach(() => {
    if (originalEnforcement === undefined) {
      delete process.env['SECTION_ACCESS_ENFORCEMENT'];
    } else {
      process.env['SECTION_ACCESS_ENFORCEMENT'] = originalEnforcement;
    }
    vi.restoreAllMocks();
  });

  it('NONE gives 403 on both GET and POST', async () => {
    vi.spyOn(db, 'query').mockResolvedValue({
      rows: [{ section: 'clients', access: 'NONE' }],
      command: 'SELECT',
      rowCount: 1,
      oid: 0,
      fields: [],
    });
    vi.spyOn(AuditService.prototype, 'logEvent').mockResolvedValue();

    const ctx: UserContext = {
      userId: USER_ID,
      organizationId: ORG_ID,
      roles: ['COORDINATOR'],
      permissions: ['clients:read', 'clients:write'],
      branchIds: [],
    };
    const app = buildApp(db, ctx);

    const getRes = await request(app).get('/api/clients');
    expect(getRes.status).toBe(403);
    expect(getRes.body).toMatchObject({
      success: false,
      code: 'SECTION_ACCESS_DENIED',
      section: 'clients',
      required: 'READ',
    });

    const postRes = await request(app).post('/api/clients').send({});
    expect(postRes.status).toBe(403);
    expect(postRes.body).toMatchObject({
      success: false,
      code: 'SECTION_ACCESS_DENIED',
      section: 'clients',
      required: 'WRITE',
    });
  });

  it('READ allows GET and blocks POST, PUT, PATCH and DELETE', async () => {
    vi.spyOn(db, 'query').mockResolvedValue({
      rows: [{ section: 'clients', access: 'READ' }],
      command: 'SELECT',
      rowCount: 1,
      oid: 0,
      fields: [],
    });
    vi.spyOn(AuditService.prototype, 'logEvent').mockResolvedValue();

    const ctx: UserContext = {
      userId: USER_ID,
      organizationId: ORG_ID,
      roles: ['SUPER_ADMIN'],
      permissions: ['*:*'],
      branchIds: [],
    };
    const app = buildApp(db, ctx);

    const getRes = await request(app).get('/api/clients');
    expect(getRes.status).toBe(200);

    const writeResponses = [
      await request(app).post('/api/clients').send({}),
      await request(app).put('/api/clients/c-1').send({}),
      await request(app).patch('/api/clients/c-1').send({}),
      await request(app).delete('/api/clients/c-1'),
    ];
    for (const res of writeResponses) {
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        code: 'SECTION_ACCESS_DENIED',
        section: 'clients',
        required: 'WRITE',
      });
    }
  });

  it('WRITE allows GET and POST', async () => {
    vi.spyOn(db, 'query').mockResolvedValue({
      rows: [{ section: 'clients', access: 'WRITE' }],
      command: 'SELECT',
      rowCount: 1,
      oid: 0,
      fields: [],
    });

    const ctx: UserContext = {
      userId: USER_ID,
      organizationId: ORG_ID,
      roles: ['READ_ONLY'],
      permissions: [],
      branchIds: [],
    };
    const app = buildApp(db, ctx);

    const getRes = await request(app).get('/api/clients');
    expect(getRes.status).toBe(200);

    const postRes = await request(app).post('/api/clients').send({});
    expect(postRes.status).toBe(200);
  });

  it('a wildcard role with no override is unaffected', async () => {
    vi.spyOn(db, 'query').mockResolvedValue({
      rows: [],
      command: 'SELECT',
      rowCount: 0,
      oid: 0,
      fields: [],
    });

    const ctx: UserContext = {
      userId: USER_ID,
      organizationId: ORG_ID,
      roles: ['SUPER_ADMIN'],
      permissions: ['*:*'],
      branchIds: [],
    };
    const app = buildApp(db, ctx);

    const getRes = await request(app).get('/api/clients');
    expect(getRes.status).toBe(200);

    const postRes = await request(app).post('/api/clients').send({});
    expect(postRes.status).toBe(200);
  });

  it('an override beats the default', async () => {
    vi.spyOn(db, 'query').mockResolvedValue({
      rows: [{ section: 'clients', access: 'NONE' }],
      command: 'SELECT',
      rowCount: 1,
      oid: 0,
      fields: [],
    });
    vi.spyOn(AuditService.prototype, 'logEvent').mockResolvedValue();

    const ctx: UserContext = {
      userId: USER_ID,
      organizationId: ORG_ID,
      roles: ['SUPER_ADMIN'],
      permissions: ['*:*'],
      branchIds: [],
    };
    const app = buildApp(db, ctx);

    const res = await request(app).get('/api/clients');
    expect(res.status).toBe(403);
    expect(res.body.section).toBe('clients');
  });

  it('the most specific prefix wins (/visits/:id/tasks goes to tasks)', async () => {
    vi.spyOn(db, 'query').mockResolvedValue({
      rows: [
        { section: 'visits', access: 'WRITE' },
        { section: 'tasks', access: 'NONE' },
      ],
      command: 'SELECT',
      rowCount: 2,
      oid: 0,
      fields: [],
    });
    vi.spyOn(AuditService.prototype, 'logEvent').mockResolvedValue();

    const ctx: UserContext = {
      userId: USER_ID,
      organizationId: ORG_ID,
      roles: ['SUPER_ADMIN'],
      permissions: ['*:*'],
      branchIds: [],
    };
    const app = buildApp(db, ctx);

    const res = await request(app).get('/api/visits/v-123/tasks');
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      code: 'SECTION_ACCESS_DENIED',
      section: 'tasks',
      required: 'READ',
    });
  });

  it('an exempt prefix is never blocked', async () => {
    vi.spyOn(db, 'query').mockResolvedValue({
      rows: [],
      command: 'SELECT',
      rowCount: 0,
      oid: 0,
      fields: [],
    });

    const ctx: UserContext = {
      userId: USER_ID,
      organizationId: ORG_ID,
      roles: [],
      permissions: [],
      branchIds: [],
    };
    const app = buildApp(db, ctx);

    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(200);
  });

  it('the read-only POST allowlist is honoured', async () => {
    vi.spyOn(db, 'query').mockResolvedValue({
      rows: [{ section: 'clients', access: 'READ' }],
      command: 'SELECT',
      rowCount: 1,
      oid: 0,
      fields: [],
    });
    vi.spyOn(AuditService.prototype, 'logEvent').mockResolvedValue();

    const ctx: UserContext = {
      userId: USER_ID,
      organizationId: ORG_ID,
      roles: ['READ_ONLY'],
      permissions: ['clients:read'],
      branchIds: [],
    };
    const app = buildApp(db, ctx);

    const allowed = await request(app).post('/api/medications/check-interactions').send({});
    expect(allowed.status).toBe(200);

    const blocked = await request(app).post('/api/medications').send({});
    expect(blocked.status).toBe(403);
    expect(blocked.body.required).toBe('WRITE');
  });

  it('shadow mode allows the request and logs SECTION_ACCESS_WOULD_DENY', async () => {
    process.env['SECTION_ACCESS_ENFORCEMENT'] = 'shadow';
    vi.spyOn(db, 'query').mockResolvedValue({
      rows: [{ section: 'clients', access: 'NONE' }],
      command: 'SELECT',
      rowCount: 1,
      oid: 0,
      fields: [],
    });
    const auditSpy = vi.spyOn(AuditService.prototype, 'logEvent').mockResolvedValue();

    const ctx: UserContext = {
      userId: USER_ID,
      organizationId: ORG_ID,
      roles: ['COORDINATOR'],
      permissions: ['clients:read'],
      branchIds: [],
    };
    const app = buildApp(db, ctx);

    const res = await request(app).get('/api/clients');
    expect(res.status).toBe(200);
    expect(auditSpy).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        eventType: 'AUTHORIZATION',
        action: 'SECTION_ACCESS_WOULD_DENY',
        result: 'FAILURE',
        metadata: expect.objectContaining({
          section: 'clients',
          required: 'READ',
          enforcement: 'shadow',
        }),
      })
    );
  });

  it('no userContext gives next()', async () => {
    const querySpy = vi.spyOn(db, 'query');
    const app = buildApp(db);

    const res = await request(app).get('/api/clients');
    expect(res.status).toBe(200);
    expect(querySpy).not.toHaveBeenCalled();
  });

  it('FAMILY and CLIENT portal roles bypass the section guard', async () => {
    const querySpy = vi.spyOn(db, 'query');
    const ctx: UserContext = {
      userId: USER_ID,
      organizationId: ORG_ID,
      roles: ['FAMILY'],
      permissions: [],
      branchIds: [],
    };
    const app = buildApp(db, ctx);

    const res = await request(app).get('/api/clients');
    expect(res.status).toBe(200);
    expect(querySpy).not.toHaveBeenCalled();
  });

  it('the audit event is written on denial', async () => {
    vi.spyOn(db, 'query').mockResolvedValue({
      rows: [{ section: 'clients', access: 'NONE' }],
      command: 'SELECT',
      rowCount: 1,
      oid: 0,
      fields: [],
    });
    const auditSpy = vi.spyOn(AuditService.prototype, 'logEvent').mockResolvedValue();

    const ctx: UserContext = {
      userId: USER_ID,
      organizationId: ORG_ID,
      roles: ['CAREGIVER'],
      permissions: [],
      branchIds: [],
    };
    const app = buildApp(db, ctx);

    const res = await request(app).post('/api/clients').send({});
    expect(res.status).toBe(403);
    expect(auditSpy).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        eventType: 'AUTHORIZATION',
        resource: '/api/clients',
        resourceId: USER_ID,
        action: 'SECTION_ACCESS_DENIED',
        result: 'FAILURE',
        metadata: expect.objectContaining({
          section: 'clients',
          required: 'WRITE',
          method: 'POST',
        }),
      })
    );
  });

  it('enumerates every app.use("/api...") mount in routes/index.ts and asserts each is in SECTION_PREFIX_TABLE or EXEMPT_PREFIXES', () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const routesIndexPath = resolve(currentDir, '../../routes/index.ts');
    const source = readFileSync(routesIndexPath, 'utf8');

    const mountRegex = /app\.use\(["']\/api\/([\da-z-]+)["']/g;
    const mounts = new Set<string>();
    let match = mountRegex.exec(source);
    while (match !== null) {
      const mountedPrefix = match[1];
      if (mountedPrefix !== undefined) {
        mounts.add(mountedPrefix);
      }
      match = mountRegex.exec(source);
    }

    expect(mounts.size).toBeGreaterThan(10);

    const tablePrefixes = new Set(SECTION_PREFIX_TABLE.map((r) => r.prefix));
    const exemptPrefixes = new Set(EXEMPT_PREFIXES);

    for (const prefix of mounts) {
      const inTableOrExempt = tablePrefixes.has(prefix) || exemptPrefixes.has(prefix);
      expect(inTableOrExempt, `Unmapped /api mount prefix: ${prefix}`).toBe(true);

      const resolution = resolveRequest('GET', `/api/${prefix}`);
      expect(resolution.kind, `resolveRequest unmapped for /api/${prefix}`).not.toBe('unmapped');
    }
  });
});
