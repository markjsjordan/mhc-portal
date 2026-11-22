import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';

const mockRequireAuth = vi.fn();

vi.mock('@folkcare/core', () => ({
  Database: vi.fn(),
  isValidUUID: (val: string) =>
    /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(val),
  AuthMiddleware: vi.fn().mockImplementation(function () {
    return {
      requireAuth: (req: Request, res: Response, next: NextFunction) =>
        mockRequireAuth(req, res, next),
    };
  }),
}));

import {
  createScheduleSnapshotsRouter,
  getWeekRange,
  serializeSnapshotToCsv,
  serializeSnapshotToPrintableHtml,
} from '../schedule-snapshots.js';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const SNAPSHOT_ID = '33333333-3333-4333-8333-333333333333';

describe('Schedule Snapshots helpers', () => {
  it('computes Monday-Sunday week range for a mid-week date', () => {
    // 2026-11-18 is Wednesday
    expect(getWeekRange('2026-11-18')).toEqual({
      weekStartDate: '2026-11-16',
      weekEndDate: '2026-11-22',
    });
  });

  it('computes Monday-Sunday week range for a Sunday date', () => {
    // 2026-11-22 is Sunday
    expect(getWeekRange('2026-11-22')).toEqual({
      weekStartDate: '2026-11-16',
      weekEndDate: '2026-11-22',
    });
  });

  it('serializes visits to CSV with formula injection protection and quoting', () => {
    const csv = serializeSnapshotToCsv([
      {
        visitId: 'v-1',
        visitNumber: 'V2026-000001',
        scheduledDate: '2026-11-18',
        scheduledStartTime: '09:00',
        scheduledEndTime: '11:00',
        status: 'SCHEDULED',
        visitType: 'REGULAR',
        serviceTypeName: 'Personal Care',
        clientId: 'c-1',
        clientName: 'Doe, Jane',
        caregiverId: 'cg-1',
        caregiverName: 'Smith, Alex',
        address: '123 Main St',
        notes: '=HYPERLINK("http://evil")',
      },
    ]);

    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('Date,Start Time,End Time');
    expect(lines[1]).toContain('"Doe, Jane"');
    expect(lines[1]).toContain('"\'=HYPERLINK(""http://evil"")"');
  });

  it('serializes snapshot to printable HTML with XSS escaping', () => {
    const html = serializeSnapshotToPrintableHtml({
      id: SNAPSHOT_ID,
      weekStartDate: '2026-11-16',
      weekEndDate: '2026-11-22',
      triggerType: 'MANUAL',
      label: '<script>alert(1)</script>',
      visitCount: 1,
      createdAt: '2026-11-20T22:00:00.000Z',
      visits: [
        {
          visitId: 'v-1',
          visitNumber: 'V2026-000001',
          scheduledDate: '2026-11-18',
          scheduledStartTime: '09:00',
          scheduledEndTime: '11:00',
          status: 'SCHEDULED',
          visitType: 'REGULAR',
          serviceTypeName: 'Personal Care',
          clientId: 'c-1',
          clientName: 'Jane <b>Doe</b>',
          caregiverId: 'cg-1',
          caregiverName: 'Alex Smith',
          address: '123 Main St',
          notes: null,
        },
      ],
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('window.print()');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Jane &lt;b&gt;Doe&lt;/b&gt;');
  });
});

describe('Schedule Snapshots API routes', () => {
  const mockQuery = vi.fn();
  const mockDb = { query: mockQuery } as unknown as Parameters<typeof createScheduleSnapshotsRouter>[0];
  let app: express.Express;
  const originalCronSecret = process.env['CRON_SECRET'];

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockImplementation((req: Request, _res: Response, next: NextFunction) => {
      req.user = {
        userId: USER_ID,
        organizationId: ORG_ID,
        email: 'admin@folkcare.example',
        roles: ['ORG_ADMIN'],
        permissions: ['*:*'],
        branchIds: [],
        tokenVersion: 1,
      } as Request['user'];
      next();
    });
    app = express();
    app.use(express.json());
    app.use('/api/schedule-snapshots', createScheduleSnapshotsRouter(mockDb));
  });

  afterEach(() => {
    if (originalCronSecret === undefined) {
      delete process.env['CRON_SECRET'];
    } else {
      process.env['CRON_SECRET'] = originalCronSecret;
    }
  });

  it('POST /api/schedule-snapshots creates an on-demand weekly snapshot', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'v-1',
            visit_number: 'V2026-000001',
            scheduled_date: '2026-11-18',
            scheduled_start_time: '09:00',
            scheduled_end_time: '11:00',
            status: 'SCHEDULED',
            visit_type: 'REGULAR',
            service_type_name: 'Personal Care',
            client_id: 'c-1',
            client_first_name: 'Jane',
            client_last_name: 'Doe',
            assigned_caregiver_id: 'cg-1',
            caregiver_first_name: 'Alex',
            caregiver_last_name: 'Smith',
            address: '123 Main St',
            notes: 'Bring supplies',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: SNAPSHOT_ID,
            organization_id: ORG_ID,
            week_start_date: '2026-11-16',
            week_end_date: '2026-11-22',
            trigger_type: 'MANUAL',
            label: 'Friday Backup',
            visit_count: 1,
            snapshot_data: [
              {
                visitId: 'v-1',
                visitNumber: 'V2026-000001',
                scheduledDate: '2026-11-18',
                scheduledStartTime: '09:00',
                scheduledEndTime: '11:00',
                status: 'SCHEDULED',
                visitType: 'REGULAR',
                serviceTypeName: 'Personal Care',
                clientId: 'c-1',
                clientName: 'Jane Doe',
                caregiverId: 'cg-1',
                caregiverName: 'Alex Smith',
                address: '123 Main St',
                notes: 'Bring supplies',
              },
            ],
            created_by: USER_ID,
            created_at: '2026-11-20T22:00:00.000Z',
          },
        ],
      });

    const res = await request(app)
      .post('/api/schedule-snapshots')
      .send({ weekStartDate: '2026-11-18', label: 'Friday Backup' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(SNAPSHOT_ID);
    expect(res.body.data.weekStartDate).toBe('2026-11-16');
    expect(res.body.data.weekEndDate).toBe('2026-11-22');
    expect(res.body.data.visitCount).toBe(1);
    expect(res.body.data.visits).toHaveLength(1);
  });

  it('GET /api/schedule-snapshots lists snapshots for the organization', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: SNAPSHOT_ID,
          organization_id: ORG_ID,
          week_start_date: '2026-11-16',
          week_end_date: '2026-11-22',
          trigger_type: 'SCHEDULED',
          label: 'Weekly Backup',
          visit_count: 5,
          created_by: null,
          created_by_email: null,
          created_at: '2026-11-20T22:00:00.000Z',
        },
      ],
    });

    const res = await request(app).get('/api/schedule-snapshots');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].triggerType).toBe('SCHEDULED');
  });

  it('GET /api/schedule-snapshots/:id/export?format=csv returns downloadable CSV', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: SNAPSHOT_ID,
          organization_id: ORG_ID,
          week_start_date: '2026-11-16',
          week_end_date: '2026-11-22',
          trigger_type: 'MANUAL',
          label: 'Test',
          visit_count: 1,
          snapshot_data: [
            {
              visitId: 'v-1',
              visitNumber: 'V2026-000001',
              scheduledDate: '2026-11-18',
              scheduledStartTime: '09:00',
              scheduledEndTime: '11:00',
              status: 'SCHEDULED',
              visitType: 'REGULAR',
              serviceTypeName: 'Personal Care',
              clientId: 'c-1',
              clientName: 'Jane Doe',
              caregiverId: 'cg-1',
              caregiverName: 'Alex Smith',
              address: '123 Main St',
              notes: null,
            },
          ],
          created_by: USER_ID,
          created_at: '2026-11-20T22:00:00.000Z',
        },
      ],
    });

    const res = await request(app).get(`/api/schedule-snapshots/${SNAPSHOT_ID}/export?format=csv`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment; filename="schedule-backup-2026-11-16-');
    expect(res.text).toContain('Jane Doe');
  });

  it('rejects non-scheduling roles with 403', async () => {
    mockRequireAuth.mockImplementationOnce((req: Request, _res: Response, next: NextFunction) => {
      req.user = {
        userId: USER_ID,
        organizationId: ORG_ID,
        email: 'family@folkcare.example',
        roles: ['FAMILY_MEMBER'],
        permissions: [],
        branchIds: [],
        tokenVersion: 1,
      } as Request['user'];
      next();
    });

    const res = await request(app).get('/api/schedule-snapshots');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');
  });

  it('POST /api/schedule-snapshots/cron/capture requires valid CRON_SECRET', async () => {
    process.env['CRON_SECRET'] = 'super-secret-cron-token';

    const unauth = await request(app).post('/api/schedule-snapshots/cron/capture');
    expect(unauth.status).toBe(401);

    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: ORG_ID, name: 'Test Org' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: SNAPSHOT_ID,
            organization_id: ORG_ID,
            week_start_date: '2026-11-16',
            week_end_date: '2026-11-22',
            trigger_type: 'SCHEDULED',
            label: 'Weekly Backup',
            visit_count: 0,
            snapshot_data: [],
            created_by: null,
            created_at: '2026-11-20T22:00:00.000Z',
          },
        ],
      });

    const auth = await request(app)
      .post('/api/schedule-snapshots/cron/capture')
      .set('Authorization', 'Bearer super-secret-cron-token');

    expect(auth.status).toBe(200);
    expect(auth.body.success).toBe(true);
    expect(auth.body.data.capturedCount).toBe(1);
  });
});
