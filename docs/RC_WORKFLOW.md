---
title: RC (Release Candidate) Deployment Workflow
description: Staging and deploying features to production via RC review gate
last_updated: October 14, 2026
---

# RC (Release Candidate) Deployment Workflow

This document describes the complete workflow for staging features in `develop`, reviewing in `preview`, and deploying to `production`.

## Overview

```
feature/* branches
      ↓
   develop (integration)
      ↓
   preview (RC staging @ Vercel)
      ↓
[Human RC Review & Approval]
      ↓
   production (live)
```

## Branches and Environments

| Branch | Environment | Database | Purpose | URL |
|--------|-------------|----------|---------|-----|
| `feature/*` | Local | Local | Active development | N/A |
| `develop` | GitHub Pages | None (localStorage) | Feature integration & showcase demo | `folk.care/` |
| `preview` | Vercel Staging | Preview DB | RC staging for human review | `preview-*.vercel.app` |
| `production` | Vercel Production | Production DB | Live system | `folk.care` |

## Workflow Phases

### Phase 1: Development → Integration (feature/* → develop)

**Goal:** Merge completed feature branches into develop for integration testing.

**Process:**
1. **Create feature branch** from develop:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b fix/ticket-id-description
   ```

2. **Implement feature** (see ticket specs)
   - Run tests: `npm run test`
   - Run linting: `npm run lint`
   - Type check: `npm run typecheck`
   - Build: `npm run build`

3. **Create PR** to develop
   - GitHub Actions runs CI (lint, typecheck, test, build)
   - All checks must pass
   - Self-review your changes
   - Merge to develop

4. **Update ClickUp ticket**
   - Move status: IN_PROGRESS → QA READY
   - Add comment: "Implementation complete, ready for QA testing"
   - Link to feature branch

### Phase 2: QA Testing (develop branch)

**Goal:** QA validates feature works as expected.

**Process:**
1. **QA tests feature** on develop branch:
   ```bash
   git checkout develop
   git pull origin develop
   npm run build
   npm run dev
   ```

2. **Test at localhost:5173 or :3000** (local development)

3. **QA Result:**
   - **PASS:** Move ClickUp ticket to QA PASSED
   - **FAIL:** Move to QA FAILURE, document issues, assign back to implementation

### Phase 3: Merge to Develop → Preview Sync

**Goal:** Get approved features staged in preview for RC review.

**Process:**
1. **After QA PASSED**, merge feature branch to develop (already done in Phase 1)

2. **Sync develop → preview** (automatic via GitHub Action)
   ```bash
   # Automatic: GitHub Action on push to develop
   # Manual: git push origin develop:preview
   ```

3. **Update ClickUp ticket**
   - Move status: QA PASSED → RC DEV BRANCH READY
   - Add comment: "Merged to develop, synced to preview. Ready for RC review."

### Phase 4: RC Review (preview environment)

**Goal:** Justin reviews all staged features in preview before production deployment.

**Process:**
1. **Accumulate 3+ tickets** in RC DEV BRANCH READY status

2. **Test in preview environment** (live Vercel staging with real backend):
   - Get preview URL: Check Vercel dashboard or GitHub Actions
   - Test all features together
   - Verify no regressions

3. **RC Review Decision:**
   - **✅ APPROVED:** Move all tickets to RC PROD BRANCH READY
   - **❌ REJECTED:** Move back to IN_PROGRESS, document issues

4. **Approval method:**
   - Comment on ClickUp tickets: "Approved for production"
   - Or: Approve GitHub PR from develop → production

### Phase 5: Deploy to Production

**Goal:** Batch deploy all approved features to production.

**Process:**
1. **All RC PROD BRANCH READY tickets ready?**
   - Check ClickUp: filter by RC PROD BRANCH READY status
   - Ensure all have been approved

2. **Sync develop → production:**
   ```bash
   git checkout develop
   git pull origin develop
   git push origin develop:production --force-with-lease
   ```

3. **Wait for deployment:**
   - GitHub Actions triggers CI and deploy on push to production
   - Vercel builds and deploys automatically
   - Check deployment status: `vercel ls`

4. **Verify production:**
   - Health check: `curl https://folk.care/health`
   - Test critical flows: login, create client, schedule visit, etc.
   - Check Sentry for errors

5. **Update ClickUp tickets:**
   - Move status: RC PROD BRANCH READY → COMPLETE
   - Add comment: "Deployed to production - [commit hash]"
   - Reference production deployment URL

## ClickUp Status Transitions

```
READY
  ↓ [Dispatch implementation]
IN_PROGRESS
  ↓ [Implementation complete]
QA READY
  ├─ [QA PASS] → QA PASSED
  └─ [QA FAIL] → QA FAILURE → IN_PROGRESS (loop)
  ↓
QA PASSED
  ↓ [Merge to develop, sync to preview]
RC DEV BRANCH READY
  ├─ [Justin APPROVES] → RC PROD BRANCH READY
  └─ [Justin REJECTS] → IN_PROGRESS (loop)
  ↓
RC PROD BRANCH READY
  ↓ [Deploy develop → production]
COMPLETE
```

## Key Commands

### Sync develop → preview (manual)
```bash
git push origin develop:preview
```

### Deploy develop → production (manual)
```bash
git push origin develop:production --force-with-lease
```

### Check deployment status
```bash
vercel ls --limit 10
```

### View preview URL
```bash
# Check recent deployments
vercel ls

# Inspect specific deployment
vercel inspect <url>
```

### Health check
```bash
curl https://folk.care/health
```

## Automation

### Auto-Sync develop → preview

**GitHub Action:** `.github/workflows/sync-develop-to-preview.yml`
- Triggers: Every push to `develop`
- Action: Automatically syncs to `preview` branch
- Optional: Sends Slack notification

**Manual trigger:**
```bash
# Trigger workflow manually
gh workflow run sync-develop-to-preview.yml
```

## Rollback Procedures

### Rollback production to previous version

1. **Identify last good commit:**
   ```bash
   git log origin/production --oneline -5
   ```

2. **Force-push previous commit:**
   ```bash
   git push origin <commit-hash>:production --force-with-lease
   ```

3. **Verify rollback:**
   ```bash
   curl https://folk.care/health
   ```

4. **Update ClickUp:**
   - Move COMPLETE tickets back to RC DEV BRANCH READY
   - Document reason for rollback
   - Plan fix

## Best Practices

1. **Keep develop stable:** Only merge tested, passing code
2. **Batch deployments:** Deploy 3+ tickets together to reduce deployment frequency
3. **Review together:** RC review sees all features integrated, catches conflicts early
4. **Test preview:** Always test in preview before approving for production
5. **Document deployments:** Record what was deployed and when in ClickUp comments
6. **Monitor production:** Check Sentry and logs after each deployment

## Troubleshooting

### Preview deployment stuck

```bash
# Check deployment status
vercel logs <deployment-url>

# Retry deployment
vercel deploy --prod
```

### Production deployment failed

1. Check GitHub Actions logs
2. Check Vercel deployment logs: `vercel inspect <url>`
3. Check database migrations ran: Check Neon dashboard
4. Rollback if critical

### Commits not in production

Check git log:
```bash
# Commits on develop but NOT in production
git log origin/production..origin/develop --oneline

# If found, push to production:
git push origin develop:production --force-with-lease
```

## Questions?

Refer to the main `AGENTS.md` for domain context, or check `.github/workflows/` for automation details.
