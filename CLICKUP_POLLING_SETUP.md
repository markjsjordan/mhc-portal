# ClickUp Polling & Workflow Setup

## Overview

Automated ClickUp ticket polling integrated into Folk Care. Polls for `READY` and `QA FAILURE` tickets twice daily and automatically triggers the MHC workflow implementation.

## Components

### 1. ClickUp Service (`packages/app/src/services/clickup.service.ts`)

Core service for ClickUp API interactions:
- **getTasksByStatus()** - Fetch tasks by status (READY, QA FAILURE)
- **pollForTickets()** - Main polling method
- **updateTaskStatus()** - Update ticket status
- **addTaskComment()** - Post comments to tickets

### 2. Cronjob Script (`packages/app/src/cron/clickup-poll.ts`)

Executable cron job that:
1. Polls ClickUp for READY/QA FAILURE tickets
2. Triggers Hermes `/clickup-mhc-workflow` for each ticket
3. Can be run standalone or via system cron

### 3. Manual Trigger Endpoint (`/webhooks/grab-tickets`)

HTTP endpoint that manually triggers polling:
```bash
curl -X POST http://localhost:3000/webhooks/grab-tickets
```

## Setup

### Prerequisites

Ensure these are in `.secrets.txt` (or environment):
```bash
CLICKUP_API_TOKEN="pk_14871500_..."
CLICKUP_LIST_ID="1000400000012236"
```

### Automated Cronjobs (macOS)

1. Open crontab editor:
   ```bash
   crontab -e
   ```

2. Add these lines (6am ET and 12pm ET):
   ```
   # ClickUp polling at 6am ET and 12pm ET
   0 6 * * * /Users/markjordan/folk-care/scripts/cron-clickup-poll.sh >> /tmp/clickup-poll-6am.log 2>&1
   0 12 * * * /Users/markjordan/folk-care/scripts/cron-clickup-poll.sh >> /tmp/clickup-poll-12pm.log 2>&1
   ```

3. Verify cron is scheduled:
   ```bash
   crontab -l
   ```

### Manual Testing

```bash
# Start dev server
npm run dev

# In another terminal, trigger polling
curl -X POST http://localhost:3000/webhooks/grab-tickets

# Watch logs for output
tail -f /tmp/clickup-poll*.log
```

## Workflow

1. **Cron Job Runs** (6am ET, 12pm ET)
2. **Polls ClickUp** for READY/QA FAILURE tickets
3. **For Each Ticket**:
   - Logs ticket details
   - Calls `hermes /clickup-mhc-workflow <ticketId>`
4. **MHC Workflow Executes** (per `clickup-mhc-workflow` skill)
   - Reads ticket spec
   - Implements changes on feature branch
   - Moves ticket to IN PROGRESS → QA READY
   - Posts comment: `@pierre - implementation complete, ready for QA testing at [URL]`

## Log Files

- **6am poll**: `/tmp/clickup-poll-6am.log`
- **12pm poll**: `/tmp/clickup-poll-12pm.log`
- **Dev server**: Check stdout

## Implementation Notes

### ESM + Fetch

- Uses native Node.js `fetch` API (no external deps)
- All imports use ESM syntax with `.js` extensions
- `node:crypto`, `node:child_process` for Node.js built-ins

### Security

- Webhook signature verification with timing-safe comparison
- Automatic handling of CLICKUP_API_TOKEN from environment
- All HTTP requests use HTTPS

### Error Handling

- Graceful degradation if ClickUp API unavailable
- Returns empty array on poll failure (doesn't crash)
- Logs all errors to console

### Timezone

- Cron uses **ET (Eastern Time)**
- 6am ET = 11am UTC (Nov-March: 10am UTC)
- 12pm ET = 5pm UTC (Nov-March: 4pm UTC)

## Future Enhancements

- Webhooks from ClickUp (push instead of poll)
- Discord notifications on ticket status changes
- Slack integration for team visibility
- Custom task filtering (priority, assignee, etc.)
- Rate limiting on API calls
