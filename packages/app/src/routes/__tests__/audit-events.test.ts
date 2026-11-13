import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Database } from '@folkcare/core';

const logEvent = vi.fn();
vi.mock('@folkcare/core', async () => {
  const actual = await vi.importActual<typeof import('@folkcare/core')>('@folkcare/core');
  return {
    ...actual,
    AuthMiddleware: vi.fn().mockImplementation(function () {
      return { requireAuth: (_q: unknown, _s: unknown, n: () => void) => n() };
    }),
    AuditService: vi.fn().mockImplementation(function () {
      return { logEvent };
    }),
  };
});

import { createAuditEventsRouter } from '../audit-events.js';

type Handler = (req: unknown, res: unknown) => Promise<void>;

function getHandler(router: unknown, path: string, method: string): Handler {
  const layers = (router as { stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: Handler }> } }> }).stack;
  const layer = layers.find((l) => l.route?.path === path && Object.entries(l.route.methods).some(([m, on]) => m === method && on));
  const stack = layer!.route!.stack;
  return stack.at(-1)!.handle;
}

function makeRes(): { statusCode: number; body: unknown; status: (c: number) => unknown; json: (b: unknown) => unknown } {
  const res = { statusCode: 200, body: undefined as unknown, status(c: number) { res.statusCode = c; return res; }, json(b: unknown) { res.body = b; return res; } };
  return res;
}

const req = (roles: string[], query: Record<string, string> = {}): Record<string, unknown> => ({
  user: { userId: 'u1', organizationId: 'org-A', roles, permissions: [], branchIds: [] },
  query,
  headers: { 'user-agent': 'ua' },
  ip: 'client-ip',
  body: {},
});

describe('audit-events router (wdvf3acxk9)', () => {
  const query = vi.fn();
  beforeEach(() => {
    query.mockReset();
    logEvent.mockReset();
    query.mockResolvedValueOnce({ rows: [{ total: '1' }] }).mockResolvedValueOnce({
      rows: [{ event_id: 'e1', timestamp: 't', event_type: 'DATA_ACCESS', resource: 'CLIENT', resource_id: 'c1', action: 'X', result: 'SUCCESS', metadata: { clientName: 'Jane', phiAccessed: true }, ip_address: null, user_id: 'gone-user', first_name: null, last_name: null, email: null, roles: null }],
    });
  });

  it('denies BRANCH_ADMIN with 403 and does not query', async () => {
    const h = getHandler(createAuditEventsRouter({ query } as unknown as Database), '/', 'get');
    const res = makeRes();
    await h(req(['BRANCH_ADMIN']), res);
    expect(res.statusCode).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('allows ORG_ADMIN, scopes by org, caps limit at 200, logs the view, shows stored id for deleted actor', async () => {
    const h = getHandler(createAuditEventsRouter({ query } as unknown as Database), '/', 'get');
    const res = makeRes();
    await h(req(['ORG_ADMIN'], { limit: '99999' }), res);
    expect(res.statusCode).toBe(200);
    expect(logEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'VIEW_AUDIT_LOGS' }));
    const dataCall = query.mock.calls[1]!;
    expect(dataCall[0]).not.toMatch(/SELECT \*/);
    expect(dataCall[1][0]).toBe('org-A');
    expect(dataCall[1]).toContain(200);
    const body = res.body as { data: { events: Array<{ actor: { name: string }; clientName?: string }> } };
    expect(body.data.events[0]!.actor.name).toBe('gone-user');
    expect(body.data.events[0]!.clientName).toBe('Jane');
  });

  it('export-log writes an EXPORT_AUDIT_LOGS row and rejects non-admins', async () => {
    const router = createAuditEventsRouter({ query } as unknown as Database);
    const h = getHandler(router, '/export-log', 'post');
    const denied = makeRes();
    await h(req(['CAREGIVER']), denied);
    expect(denied.statusCode).toBe(403);
    expect(logEvent).not.toHaveBeenCalled();
    const ok = makeRes();
    await h(req(['SUPER_ADMIN']), ok);
    expect(ok.statusCode).toBe(200);
    expect(logEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'EXPORT_AUDIT_LOGS' }));
  });
});
