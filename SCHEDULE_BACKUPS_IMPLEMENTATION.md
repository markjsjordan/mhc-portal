# Weekly Schedule Backups for Offline Resilience

**ClickUp Ticket:** wdvf3add1c  
**Branch:** `feature/wdvf3add1c-schedule-backups`  
**Status:** ✅ Implemented and Pushed

## Overview

Implements weekly schedule snapshot/backup functionality to provide offline resilience and disaster recovery capabilities for the MHC Portal scheduling system.

## Features Implemented

### 1. Backup API Endpoints

#### `POST /api/schedule/backup`
Creates a manual backup of schedule data.

**Request Body:**
```json
{
  "format": "CSV" | "PDF" | "JSON",
  "startDate": "2026-11-23",  // Optional, defaults to current week Monday
  "endDate": "2026-11-29",    // Optional, defaults to current week Sunday
  "branchIds": ["branch-id"]  // Optional, filters by branches
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "metadata": {
      "id": "backup-123",
      "organizationId": "org-456",
      "startDate": "2026-11-23",
      "endDate": "2026-11-29",
      "format": "CSV",
      "triggerType": "MANUAL",
      "visitCount": 150,
      "caregiverCount": 25,
      "clientCount": 100,
      "createdAt": "2026-11-25T10:00:00Z"
    },
    "exportData": "...",  // Backup data in requested format
    "filename": "schedule-backup-2026-11-23-to-2026-11-29.csv",
    "contentType": "text/csv"
  }
}
```

#### `GET /api/schedule/backup/latest`
Retrieves the latest backup for offline fallback.

**Query Parameters:**
- `format`: CSV | PDF | JSON (optional, default: JSON)

**Response:**
```json
{
  "success": true,
  "data": {
    "metadata": { ... },
    "visits": [ ... ],
    "caregivers": [ ... ],
    "clients": [ ... ]
  },
  "isFallback": false
}
```

If no backup exists, generates one on-the-fly with `isFallback: true`.

#### `GET /api/schedule/backup/history`
Lists backup history.

**Query Parameters:**
- `limit`: number (default: 10, max: 50)
- `offset`: number (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "backup-123",
      "format": "CSV",
      "startDate": "2026-11-23",
      "endDate": "2026-11-29",
      "visitCount": 150,
      "createdAt": "2026-11-25T10:00:00Z"
    }
  ],
  "count": 10,
  "total": 50,
  "limit": 10,
  "offset": 0
}
```

### 2. Export Formats

#### CSV Export
- Section-based structure (Visits, Caregivers, Clients)
- Proper escaping of special characters
- Includes metadata headers

#### PDF Export (HTML-based)
- Professional HTML layout with styling
- Tabular data presentation
- Summary statistics
- Ready for conversion to PDF via print-to-PDF

#### JSON Export
- Complete structured data
- Full metadata included
- Easy to parse and process

### 3. Database Schema

**Table:** `schedule_backups`

```sql
CREATE TABLE schedule_backups (
  id VARCHAR(255) PRIMARY KEY,
  organization_id UUID NOT NULL,
  branch_ids JSONB DEFAULT '[]'::jsonb,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  format VARCHAR(10) NOT NULL CHECK (format IN ('CSV', 'PDF', 'JSON')),
  trigger_type VARCHAR(20) NOT NULL CHECK (trigger_type IN ('MANUAL', 'AUTOMATED')),
  triggered_by UUID NOT NULL,
  visit_count INTEGER NOT NULL DEFAULT 0,
  caregiver_count INTEGER NOT NULL DEFAULT 0,
  client_count INTEGER NOT NULL DEFAULT 0,
  backup_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
```

**Features:**
- Organization-scoped with foreign key
- Indexed for fast queries
- 90-day retention (via expires_at)
- Full JSONB storage for complete data recovery

### 4. Access Control

**Allowed Roles:**
- SUPER_ADMIN
- ORG_ADMIN
- BRANCH_ADMIN
- COORDINATOR
- SUPERVISOR
- ADMINISTRATOR

**Security:**
- Authentication required (via AuthMiddleware)
- Organization-scoped data access
- Audit trail logging for all operations
- Branch filtering support

### 5. Testing

Comprehensive test coverage includes:
- Router initialization
- Date range calculations
- Export format generation (CSV, HTML, JSON)
- Access control validation
- Backup metadata creation
- Database integration handling

**Run tests:**
```bash
npm --workspace=@folkcare/app test -- schedule-backup.test.ts
```

## Implementation Details

### File Structure

```
packages/app/src/routes/
├── schedule-backup.ts                    # Main API route implementation
└── __tests__/
    └── schedule-backup.test.ts           # Test suite

scripts/migrations/
└── 008_schedule_backups.sql              # Database migration
```

### Dependencies

- `@folkcare/core`: Database, auth, audit, providers
- `@folkcare/scheduling-visits`: ScheduleRepository
- Express router and middleware

### Configuration

No configuration required. The feature:
- Auto-detects current week range
- Handles missing database table gracefully
- Uses sensible defaults (90-day retention)

## Usage Examples

### Manual Backup (CSV)
```bash
curl -X POST https://api.mhc-portal.com/api/schedule/backup \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"format": "CSV"}'
```

### Get Latest Backup (Offline Fallback)
```bash
curl https://api.mhc-portal.com/api/schedule/backup/latest \
  -H "Authorization: Bearer <token>"
```

### Custom Date Range
```bash
curl -X POST https://api.mhc-portal.com/api/schedule/backup \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "JSON",
    "startDate": "2026-12-01",
    "endDate": "2026-12-07"
  }'
```

## Next Steps (Future Enhancements)

1. **Frontend UI**
   - Add "Backup Schedule" button in admin dashboard
   - Display backup history
   - Offline indicator with cached data display

2. **Automated Backups**
   - Cron job for Friday EOB automated backups
   - Email notifications on backup completion
   - Backup failure alerts

3. **Advanced Features**
   - Differential backups (only changes)
   - Compressed backup storage
   - Actual PDF generation (not HTML)
   - Backup restore functionality
   - Multi-week backup ranges

4. **Performance Optimizations**
   - Streaming large exports
   - Background job processing
   - Pagination for large datasets

## Migration

To apply the database migration:

```bash
# Using your preferred migration tool
psql $DATABASE_URL -f scripts/migrations/008_schedule_backups.sql
```

Or integrate with your existing migration system (Drizzle, Prisma, etc.)

## Validation

**TypeCheck:** ✅ Passing  
**Lint:** ✅ Passing (with pre-existing warnings in other files)  
**Tests:** ✅ 15 test cases  
**Pre-commit hooks:** ✅ Passed  
**Git push:** ✅ Successful

## Deliverables

✅ Backup API endpoint with CSV/PDF/JSON export  
✅ Database schema migration  
✅ Offline fallback mechanism  
✅ Access control implementation  
✅ Test coverage  
✅ Pushed to `origin/feature/wdvf3add1c-schedule-backups`

**Ready for:**
- Code review
- Frontend UI integration
- QA testing
- Deployment to preview environment

---

**Implementation completed by:** Automated subagent  
**Date:** 2026-11-22  
**ClickUp:** wdvf3add1c
