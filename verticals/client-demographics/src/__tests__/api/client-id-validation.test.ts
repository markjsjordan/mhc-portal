/**
 * Malformed-id guards for GET/PATCH/DELETE /clients/:id (ticket wdvf3ad4dm).
 * A non-UUID id must yield 400, never reach the service (which would hit a
 * uuid column and raise Postgres 22P02 -> 500).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';

vi.mock('@folkcare/core', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@folkcare/core');
  return {
    ...actual,
    AuthMiddleware: class {
      requireAuth = (req: any, _res: any, next: any) => {
        const user = {
          userId: 'user-1',
          organizationId: 'org-1',
          roles: ['ADMIN'],
          permissions: ['clients:read', 'clients:update', 'clients:delete'],
        };
        req.user = user;
        req.userContext = user;
        next();
      };
    },
  };
});

import { NotFoundError } from '@folkcare/core';
import { createClientRouter } from '../../api/client-handlers';

const KNOWN_ID = '323e4567-e89b-12d3-a456-426614174000';
const UNKNOWN_ID = '423e4567-e89b-12d3-a456-426614174000';
const BAD_ID_BODY = { success: false, error: 'Client ID must be a valid UUID' };

describe('client /:id malformed id guard', () => {
  let app: Express;
  let service: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    service = {
      getClientById: vi.fn(),
      updateClient: vi.fn(),
      deleteClient: vi.fn(),
      getClientSummary: vi.fn(),
    };
    app = express();
    app.use(express.json());
    app.use('/api', createClientRouter(service as any, {} as any));
    app.use((err: Error & { statusCode?: number }, _req: any, res: any, _next: any) => {
      res.status(err.statusCode ?? 500).json({ success: false, error: err.message });
    });
  });

  it('GET /clients/:id returns 400 for a non-UUID id without calling the service', async () => {
    const res = await request(app).get('/api/clients/client-101');
    expect(res.status).toBe(400);
    expect(res.body).toEqual(BAD_ID_BODY);
    expect(service['getClientById']).not.toHaveBeenCalled();
  });

  it('PATCH /clients/:id returns 400 for a non-UUID id', async () => {
    const res = await request(app).patch('/api/clients/client-101').send({ firstName: 'A' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(BAD_ID_BODY);
    expect(service['updateClient']).not.toHaveBeenCalled();
  });

  it('DELETE /clients/:id returns 400 for a non-UUID id', async () => {
    const res = await request(app).delete('/api/clients/client-101');
    expect(res.status).toBe(400);
    expect(res.body).toEqual(BAD_ID_BODY);
    expect(service['deleteClient']).not.toHaveBeenCalled();
  });

  it('GET /clients/:id/summary (sub-route) returns 400 for a non-UUID id', async () => {
    const res = await request(app).get('/api/clients/client-101/summary');
    expect(res.status).toBe(400);
    expect(res.body).toEqual(BAD_ID_BODY);
    expect(service['getClientSummary']).not.toHaveBeenCalled();
  });

  it('GET /clients/:id returns 404 for a valid but unknown UUID', async () => {
    service['getClientById']!.mockRejectedValue(new NotFoundError('Client not found', { id: UNKNOWN_ID }));
    const res = await request(app).get(`/api/clients/${UNKNOWN_ID}`);
    expect(res.status).toBe(404);
    expect(service['getClientById']).toHaveBeenCalledWith(UNKNOWN_ID, expect.anything());
  });

  it('GET /clients/:id returns 200 for a real record', async () => {
    service['getClientById']!.mockResolvedValue({ id: KNOWN_ID, firstName: 'Test' });
    const res = await request(app).get(`/api/clients/${KNOWN_ID}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { id: KNOWN_ID, firstName: 'Test' } });
  });
});
