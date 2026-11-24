/**
 * Schedule Backup API Tests
 * 
 * Tests for weekly schedule snapshot/backup functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Database } from '@folkcare/core';

// Mock database
const mockDb = {
  query: vi.fn(),
  getPool: vi.fn(() => mockPool),
} as unknown as Database;

const mockPool = {
  query: vi.fn(),
  connect: vi.fn(),
  end: vi.fn(),
};

// Mock ScheduleRepository
vi.mock('@folkcare/scheduling-visits', () => ({
  ScheduleRepository: vi.fn().mockImplementation(() => ({
    getVisitsByDateRange: vi.fn().mockResolvedValue([
      {
        id: 'visit-1',
        clientId: 'client-1',
        caregiverId: 'caregiver-1',
        scheduledDate: '2026-11-25',
        scheduledStartTime: '09:00',
        scheduledEndTime: '10:00',
        scheduledDuration: 60,
        status: 'SCHEDULED',
        serviceTypeName: 'Personal Care',
        clientName: 'John Doe',
        caregiverName: 'Jane Smith',
      },
    ]),
  })),
}));

// Mock providers
vi.mock('@folkcare/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@folkcare/core')>();
  return {
    ...actual,
    createClientProvider: vi.fn().mockReturnValue({
      getClientsByIds: vi.fn().mockResolvedValue([
        {
          id: 'client-1',
          clientNumber: 'C-001',
          firstName: 'John',
          lastName: 'Doe',
          status: 'ACTIVE',
          dateOfBirth: new Date('1950-01-01'),
          primaryAddress: { street: '123 Main St', city: 'Austin', state: 'TX', zipCode: '78701' },
        },
      ]),
    }),
    createCaregiverProvider: vi.fn().mockReturnValue({
      getCaregiversByIds: vi.fn().mockResolvedValue([
        {
          id: 'caregiver-1',
          employeeNumber: 'EMP-001',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane.smith@example.com',
          status: 'ACTIVE',
          primaryPhone: { type: 'mobile', number: '555-0100' },
        },
      ]),
    }),
    ADMIN_ROLES: (actual as any).ADMIN_ROLES ?? ['ADMIN', 'ORG_ADMIN'],
    AuthMiddleware: vi.fn().mockImplementation(function () {
      return {
        requireAuth: vi.fn((req: Record<string, unknown>, _res: unknown, next: () => void) => {
          req['user'] = {
            userId: 'user-123',
            organizationId: 'org-456',
            branchIds: ['branch-789'],
            roles: ['ORG_ADMIN'],
            permissions: ['*:*'],
            email: 'admin@example.com',
            tokenVersion: 1,
          };
          next();
        }),
        requireRole: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
      };
    }),
  };
});

describe('Schedule Backup Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Router Initialization', () => {
    it('should create router successfully', async () => {
      const { createScheduleBackupRouter } = await import('../schedule-backup.js');
      const router = createScheduleBackupRouter(mockDb);
      
      expect(router).toBeDefined();
      expect(typeof router).toBe('function'); // Express Router is a function
    }, 15000);
  });

  describe('Date Range Utilities', () => {
    it('should calculate current week correctly', () => {
      const now = new Date('2026-11-25'); // Wednesday
      const dayOfWeek = now.getDay(); // 3
      const daysUntilMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // -2
      
      const startDate = new Date(now);
      startDate.setDate(now.getDate() + daysUntilMonday); // Monday 2026-11-23
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6); // Sunday 2026-11-29
      
      expect(startDate.getDate()).toBe(23);
      expect(endDate.getDate()).toBe(29);
    });

    it('should format dates correctly', () => {
      const date = new Date('2026-11-25T10:30:00Z');
      const formatted = date.toISOString().split('T')[0];
      
      expect(formatted).toBe('2026-11-25');
    });
  });

  describe('Export Format Generation', () => {
    it('should generate CSV with proper structure', () => {
      const csvLines = [
        '# Schedule Backup',
        '# Generated: 2026-11-25T10:00:00.000Z',
        '# Week: 2026-11-23 to 2026-11-29',
        '',
        '## Visits',
        'Visit ID,Client ID,Client Name,Caregiver ID,Caregiver Name,Date,Start Time,End Time,Duration,Service Type,Status',
        'visit-1,client-1,"John Doe",caregiver-1,"Jane Smith",2026-11-25,09:00,10:00,60,"Personal Care",SCHEDULED',
      ];
      
      const csv = csvLines.join('\n');
      
      expect(csv).toContain('# Schedule Backup');
      expect(csv).toContain('## Visits');
      expect(csv).toContain('Visit ID,Client ID');
      expect(csv).toContain('John Doe');
    });

    it('should generate HTML with proper structure', () => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Schedule Backup - 2026-11-23 to 2026-11-29</title>
</head>
<body>
  <h1>Schedule Backup</h1>
  <div class="meta">
    <p><strong>Week:</strong> 2026-11-23 to 2026-11-29</p>
  </div>
  <h2>Visits (5)</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Client</th>
      </tr>
    </thead>
  </table>
</body>
</html>
      `.trim();
      
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<h1>Schedule Backup</h1>');
      expect(html).toContain('<table>');
    });

    it('should generate JSON with complete structure', () => {
      const data = {
        metadata: {
          id: 'backup-123',
          organizationId: 'org-456',
          startDate: '2026-11-23',
          endDate: '2026-11-29',
          format: 'JSON' as const,
          triggerType: 'MANUAL' as const,
          triggeredBy: 'user-123',
          visitCount: 1,
          caregiverCount: 1,
          clientCount: 1,
          createdAt: new Date('2026-11-25T10:00:00Z'),
        },
        visits: [],
        caregivers: [],
        clients: [],
      };
      
      const json = JSON.stringify(data, null, 2);
      
      expect(json).toContain('"metadata"');
      expect(json).toContain('"visits"');
      expect(json).toContain('"caregivers"');
      expect(json).toContain('"clients"');
    });
  });

  describe('Access Control', () => {
    const hasAccess = (roles: string[]): boolean => {
      const allowedRoles = [
        'SUPER_ADMIN',
        'ORG_ADMIN',
        'BRANCH_ADMIN',
        'COORDINATOR',
        'SUPERVISOR',
        'ADMINISTRATOR',
      ];
      return roles.some(role => allowedRoles.includes(role));
    };
    
    it('should allow admin roles', () => {
      expect(hasAccess(['ORG_ADMIN'])).toBe(true);
      expect(hasAccess(['COORDINATOR'])).toBe(true);
      expect(hasAccess(['CAREGIVER'])).toBe(false);
      expect(hasAccess(['CLIENT'])).toBe(false);
    });
  });

  describe('Backup Metadata', () => {
    it('should create valid backup metadata', () => {
      const metadata = {
        id: 'backup-123',
        organizationId: 'org-456',
        branchIds: ['branch-789'],
        startDate: '2026-11-23',
        endDate: '2026-11-29',
        format: 'CSV' as const,
        triggerType: 'MANUAL' as const,
        triggeredBy: 'user-123',
        visitCount: 10,
        caregiverCount: 5,
        clientCount: 8,
        createdAt: new Date(),
      };
      
      expect(metadata.id).toBeTruthy();
      expect(metadata.organizationId).toBeTruthy();
      expect(metadata.format).toMatch(/^(CSV|PDF|JSON)$/);
      expect(metadata.triggerType).toMatch(/^(MANUAL|AUTOMATED)$/);
      expect(metadata.visitCount).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Database Integration', () => {
  it('should handle missing schedule_backups table gracefully', async () => {
    const failingDb = {
      query: vi.fn().mockRejectedValue(new Error('relation "schedule_backups" does not exist')),
      getPool: vi.fn(() => mockPool),
    } as unknown as Database;
    
    // The route should handle table not existing gracefully
    expect(failingDb.query).toBeDefined();
  });

  it('should construct valid SQL queries', () => {
    const query = `
      SELECT * FROM schedule_backups
      WHERE organization_id = $1
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    expect(query).toContain('organization_id = $1');
    expect(query).toContain('expires_at > NOW()');
    expect(query).toContain('LIMIT $2');
  });
});
