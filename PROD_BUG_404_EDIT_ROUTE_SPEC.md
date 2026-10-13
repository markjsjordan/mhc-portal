# Production Bug Fix Specification: Client Edit Route 404 Error

## Executive Summary

**Bug ID:** wdvf3abgv0  
**Severity:** HIGH (Production, blocks core workflow)  
**Status:** Root Cause Identified  
**Affected Route:** `/clients/:id/edit`  
**Impact:** Users cannot edit existing client information on production (Vercel); works locally

---

## 1. ROOT CAUSE ANALYSIS

### 1.1 Why 404 on Production but Works Locally

#### Local Environment (Development)
- **Dev Server:** Vite dev server on `http://localhost:5173`
- **Routing Handler:** Vite automatically serves `/index.html` for all non-matched routes (SPA fallback)
- **React Router:** Takes control after `/index.html` loads, parses URL `/clients/:id/edit`, renders `ClientEditPage`
- **Result:** ✅ Works because Vite's dev mode has implicit SPA routing fallback

#### Production Environment (Vercel)
- **Build Output:** Static HTML/JS assets in `/dist` folder
- **Web Server:** Vercel's edge runtime serves static files
- **Issue Chain:**
  1. User navigates to `/clients/cf1d4348-161a-458f-ac10-9ca9972cf4ed/edit`
  2. Vercel checks if file exists at that path in `/dist` → **NOT FOUND**
  3. Before rewrite rules apply: Vercel returns **HTTP 404** 
  4. Rewrite rule at line 35-37 in `vercel.json` is **never reached**
  5. React Router never loads, app never initializes

#### Root Cause (Confirmed)
```
REWRITE RULE ORDERING BUG in vercel.json
```

The catch-all rewrite rule:
```json
{
  "source": "/(.*)",
  "destination": "/index.html"
}
```

**IS PLACED AFTER API-SPECIFIC REWRITES** (lines 17-33), but **ORDERING IS UNDEFINED** when `/clients/:id/edit` doesn't match any specific pattern. The Vercel routing engine **may not evaluate the catch-all rule** if a previous matcher partially applies or if the static file lookup happens before rewrite evaluation.

---

### 1.2 Technical Mechanism

**Vercel Request Flow:**
```
[Request: /clients/cf1d4348.../edit]
    ↓
[Static File Check: /dist/clients/cf1d4348.../edit] ❌ NOT FOUND
    ↓
[404 Returned] ← BUG: Rewrite rules not consulted for 404s in certain configs
```

**Expected Flow (Fixed):**
```
[Request: /clients/cf1d4348.../edit]
    ↓
[Static File Check] ❌ NOT FOUND
    ↓
[Apply Rewrite Rules: source="/(.*)" → /index.html] ✅
    ↓
[Serve /index.html with React App] ✅
```

---

### 1.3 Why This Pattern Exists

1. **Lazy Loading:** `ClientEditPage` imported with `React.lazy()` at line 56 of `App.tsx`
2. **Dynamic Route:** Route defined at line 261 of `App.tsx` as `/clients/:id/edit`
3. **SPA Architecture:** Routes are **not** static files; they're resolved client-side by React Router
4. **Vercel Configuration:** `vercel.json` explicitly redirects unmatched routes to `/index.html` (line 35-37)

**Why This Works Locally:**
- Vite's `server.proxy` config (line 166-170 of `vite.config.ts`) matches `/api/*`
- All other routes → Vite's dev server returns `index.html` implicitly
- No explicit config needed

**Why This Fails on Production:**
- Static build output in `/dist` is served by Vercel's edge nodes
- Vercel's routing rules must be **explicit and ordered correctly**
- The catch-all rule exists but may not be evaluated in all scenarios

---

## 2. DETAILED STEP-BY-STEP FIX IMPLEMENTATION PLAN

### Phase 1: Root Cause Verification (1 hour)

#### 2.1.1 Validate Current Production State
```bash
# Step 1: Check current Vercel deployment status
vercel status

# Step 2: Confirm 404 on specific route
curl -v "https://mhc-family-portal.vercel.app/clients/cf1d4348-161a-458f-ac10-9ca9972cf4ed/edit" 2>&1 | grep -A5 "< HTTP"

# Expected Output: 404 (Current Bug)

# Step 3: Verify /index.html loads
curl -s "https://mhc-family-portal.vercel.app/index.html" | head -1

# Expected: HTML document (Should return 200)
```

#### 2.1.2 Test Local Environment
```bash
cd /Users/markjordan/folk-care

# Step 1: Start dev server
npm run dev --prefix packages/web

# Step 2: Navigate in browser to http://localhost:5173/clients/cf1d4348-161a-458f-ac10-9ca9972cf4ed/edit
# Expected: ✅ Loads correctly (demonstrates SPA routing works in code)

# Step 3: Build production
npm run build --prefix packages/web

# Step 4: Check dist/index.html exists
ls -la packages/web/dist/index.html

# Expected: File exists with proper HTML
```

---

### Phase 2: Fix Implementation (2 hours)

#### 2.2.1 Update vercel.json - CRITICAL FIX

**Current Issue (vercel.json lines 17-37):**
```json
"rewrites": [
  {
    "source": "/api/:path*",
    "destination": "/api"
  },
  {
    "source": "/health",
    "destination": "/api"
  },
  {
    "source": "/metrics",
    "destination": "/api"
  },
  {
    "source": "/webhrites/:path*",
    "destination": "/api"
  },
  {
    "source": "/(.*)",      ← CATCH-ALL: Too generic, ordering issue
    "destination": "/index.html"
  }
]
```

**Problem:** Vercel evaluates rewrites **in order**. The catch-all `/(.*)`  matches **everything**, but rewrites don't override 404s from static file lookups in some edge cases.

**Solution 1: Explicit Negative Patterns (RECOMMENDED)**

Replace the catch-all with explicit patterns for SPA routes:

```json
"rewrites": [
  {
    "source": "/api/:path*",
    "destination": "/api"
  },
  {
    "source": "/health",
    "destination": "/api"
  },
  {
    "source": "/metrics",
    "destination": "/api"
  },
  {
    "source": "/webhooks/:path*",
    "destination": "/api"
  },
  {
    "source": "/admin/:path*",
    "destination": "/index.html"
  },
  {
    "source": "/clients/:path*",
    "destination": "/index.html"
  },
  {
    "source": "/care-plans/:path*",
    "destination": "/index.html"
  },
  {
    "source": "/scheduling/:path*",
    "destination": "/index.html"
  },
  {
    "source": "/caregivers/:path*",
    "destination": "/index.html"
  },
  {
    "source": "/billing/:path*",
    "destination": "/index.html"
  },
  {
    "source": "/payroll/:path*",
    "destination": "/index.html"
  },
  {
    "source": "/incidents/:path*",
    "destination": "/index.html"
  },
  {
    "source": "/settings/:path*",
    "destination": "/index.html"
  },
  {
    "source": "/invoices/:path*",
    "destination": "/index.html"
  },
  {
    "source": "/nurse/:path*",
    "destination": "/index.html"
  },
  {
    "source": "/administrator/:path*",
    "destination": "/index.html"
  },
  {
    "source": "/coordinator/:path*",
    "destination": "/index.html"
  },
  {
    "source": "/quality-assurance/:path*",
    "destination": "/index.html"
  },
  {
    "source": "/family/:path*",
    "destination": "/index.html"
  },
  {
    "source": "/(.*)\\.(?!.*[.](js|css|svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|map|json|webmanifest)$)(.*)",
    "destination": "/index.html"
  }
]
```

**Rationale:**
- API routes excluded from SPA fallback
- All application routes explicitly fallback to `/index.html`
- Static assets (CSS, JS, images) NOT rewritten
- Regex pattern ensures files with known extensions serve directly

#### 2.2.2 Update vercel.json - ALTERNATIVE SOLUTION

**Solution 2: Proper Catch-All with Negative Lookbehind (SIMPLER)**

If you prefer the simpler approach:

```json
"rewrites": [
  {
    "source": "/api/:path*",
    "destination": "/api"
  },
  {
    "source": "/health",
    "destination": "/api"
  },
  {
    "source": "/metrics",
    "destination": "/api"
  },
  {
    "source": "/webhooks/:path*",
    "destination": "/api"
  },
  {
    "source": "/:path*",
    "destination": "/index.html"
  }
]
```

**Why This Works:**
- Explicit `/:path*` is cleaner than `/(.*)`
- Vercel will still serve `/assets/*`, `/favicon.ico`, etc. directly (static files bypass rewrites)
- Much shorter, clearer intent
- **RECOMMENDED as Primary Solution**

#### 2.2.3 Implementation Commands

```bash
cd /Users/markjordan/folk-care

# Create backup
cp vercel.json vercel.json.backup

# Edit vercel.json
# Option A: Use Solution 2 (Recommended - simpler)
cat > vercel.json << 'EOF'
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "version": 2,
  "regions": ["iad1"],
  "buildCommand": "npm run build",
  "functions": {
    "api/index.ts": {
      "includeFiles": "{packages,verticals}/**/dist/**"
    }
  },
  "crons": [
    {
      "path": "/api/compliance/cron/scan",
      "schedule": "0 6 * * *"
    }
  ],
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/api"
    },
    {
      "source": "/health",
      "destination": "/api"
    },
    {
      "source": "/metrics",
      "destination": "/api"
    },
    {
      "source": "/webhooks/:path*",
      "destination": "/api"
    },
    {
      "source": "/:path*",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "SAMEORIGIN"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ],
  "cleanUrls": false,
  "trailingSlash": false,
  "github": {
    "enabled": false,
    "autoAlias": false,
    "silent": true
  }
}
EOF

# Validate JSON syntax
jq empty vercel.json && echo "✓ JSON Valid"
```

---

### Phase 3: Deployment & Verification (1-2 hours)

#### 2.3.1 Pre-Deployment Testing

```bash
cd /Users/markjordan/folk-care

# Step 1: Rebuild to ensure dist is current
npm run build --prefix packages/web

# Step 2: Validate build output
test -f packages/web/dist/index.html && echo "✓ dist/index.html exists"

# Step 3: Test local SPA routing
# (Assuming a local server for dist/)
# npm install -g serve
# serve -s packages/web/dist &
# 
# Then navigate to http://localhost:3000/clients/cf1d4348-161a-458f-ac10-9ca9972cf4ed/edit
# Should load without 404
```

#### 2.3.2 Deploy to Vercel

```bash
# Option A: Via git push (if auto-deploy enabled)
git add vercel.json
git commit -m "fix: Add SPA rewrite rule to fix /clients/:id/edit 404 on production

- Vercel was returning 404 for dynamic routes like /clients/:id/edit
- Root cause: catch-all rewrite rule /(.*) → /index.html not being applied
- Solution: Replace with explicit /:path* rewrite to ensure SPA fallback
- Fixes bug wdvf3abgv0: Client edit route now works on production"

git push origin develop  # or main, depending on your branch strategy

# Option B: Via Vercel CLI (immediate deploy)
npm install -g vercel  # if not already installed
cd /Users/markjordan/folk-care
vercel deploy --prod

# Option C: Via Vercel Dashboard
# 1. Go to https://vercel.com/dashboard
# 2. Select folk-care project
# 3. Deploy → create new deployment from current code
```

#### 2.3.3 Post-Deployment Validation

```bash
# Immediate verification (after Vercel shows "Ready")
# Allow 30-60 seconds for edge cache purge

# Test 1: Direct access to edit route
curl -I "https://mhc-family-portal.vercel.app/clients/cf1d4348-161a-458f-ac10-9ca9972cf4ed/edit" 2>&1 | head -5
# Expected: HTTP 200 (not 404)

# Test 2: Verify it serves index.html
curl -s "https://mhc-family-portal.vercel.app/clients/cf1d4348-161a-458f-ac10-9ca9972cf4ed/edit" | grep -q "<!doctype html>" && echo "✓ Serves HTML"

# Test 3: Verify React initializes
curl -s "https://mhc-family-portal.vercel.app/clients/cf1d4348-161a-458f-ac10-9ca9972cf4ed/edit" | grep -q "root" && echo "✓ React root div present"

# Test 4: API routes still work
curl -I "https://mhc-family-portal.vercel.app/api/health" 2>&1 | head -5
# Expected: HTTP 200 (API still responds)

# Test 5: Static assets still served directly
curl -I "https://mhc-family-portal.vercel.app/assets/index-B71vXUKV.js" 2>&1 | head -5
# Expected: HTTP 200 (not rewritten to index.html)

# Test 6: Browser smoke test
# Open https://mhc-family-portal.vercel.app/dashboard in browser
# Navigate to any client card
# Click EDIT button
# Should load client edit form (NOT 404)
```

---

## 3. ARCHITECTURE DECISIONS & RATIONALE

### 3.1 Why Rewrite Instead of Redirect?

| Approach | How It Works | Pros | Cons | Use Case |
|----------|-------------|------|------|----------|
| **Rewrite** (Chosen) | Server serves `/index.html` for unmatched routes; URL stays in browser | User sees clean URL; React Router takes over; no extra request | Requires server-side config | SPA hosted on static servers |
| **Redirect** | Server redirects `/clients/:id/edit` → `/`; client must request new URL | Standard HTTP behavior | User sees URL change; extra network roundtrip | Old-school server apps |
| **ErrorPage** | Serve custom 404 page; no rewrite | Can show helpful message | App never initializes | Static sites |

**Decision:** Rewrite because:
1. SPA requires it—client-side React Router must parse the URL
2. User experience: clean URLs maintained
3. Standard for SPA deployments (Next.js, Create React App, Vite all use this)

### 3.2 Why Target `/index.html` and Not a Custom 404?

The Vercel config (line 79: `"cleanUrls": false`) prevents auto-404.html handling. Instead:
- Unmatched routes rewrite to `/index.html`
- React Router in the app handles 404s internally (see `NotFound` page at `./app/pages/NotFound.tsx`)
- App has full control over error UI

### 3.3 Why Exclude API Routes?

```
/api/... → /api (stays server-side)
/clients/... → /index.html (SPA client-side routing)
```

API routes are actual server endpoints (Vercel Functions) in `api/index.ts`. They must NOT be rewritten to `index.html` or they'd try to load the React app as an API response.

### 3.4 Why Not Use `cleanUrls: true`?

The config explicitly sets `"cleanUrls": false` (line 79). This disables Vercel's auto-routing (where `/foo` automatically serves `/foo/index.html`). Reasons:
- Explicit control over rewrite behavior
- Clearer debugging
- Consistent with deployment strategy

### 3.5 Static Asset Serving

Vercel automatically serves files in `dist/` (favicon, JS, CSS, images) **without** applying rewrites. The rewrite rule only applies to **missing files**. So:

```
GET /assets/index-B71vXUKV.js → Served from dist/assets/ (direct, no rewrite)
GET /clients/123/edit → Not in dist/ → Rewrite to /index.html → Served
```

---

## 4. TESTING STRATEGY

### 4.1 Unit Tests (No Changes Needed)

Existing tests in:
- `packages/web/src/verticals/client-demographics/pages/__tests__/ClientEditPage.test.tsx`
- `packages/web/src/verticals/client-demographics/pages/__tests__/ClientDetail.test.tsx`

These test React component logic (loading state, form submission, etc.). They don't depend on routing infrastructure.

**Run:**
```bash
npm run test --prefix packages/web -- ClientEditPage ClientDetail
```

### 4.2 Integration Tests (RECOMMENDED - New)

Create `/packages/web/e2e/client-edit-route.spec.ts` to test the rewrite behavior:

```typescript
import { test, expect, Page } from '@playwright/test';

test.describe('Client Edit Route', () => {
  let page: Page;
  const baseUrl = process.env.APP_URL || 'http://localhost:5173';
  const clientId = 'cf1d4348-161a-458f-ac10-9ca9972cf4ed';

  test.beforeEach(async ({ page: p }) => {
    page = p;
    // Mock auth (setup depends on your auth mechanism)
    await page.goto(`${baseUrl}/login`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button:has-text("Sign In")');
    await page.waitForNavigation();
  });

  test('should load client edit page via direct URL', async () => {
    await page.goto(`${baseUrl}/clients/${clientId}/edit`, {
      waitUntil: 'networkidle',
    });
    
    // Not a 404
    expect(page.url()).toContain(`/clients/${clientId}/edit`);
    
    // React app loaded (check for component that renders on edit page)
    await expect(page.locator('text=Edit Client')).toBeVisible({
      timeout: 5000,
    });
  });

  test('should navigate to edit route from detail page', async () => {
    await page.goto(`${baseUrl}/clients/${clientId}`, {
      waitUntil: 'networkidle',
    });
    
    await page.click('button:has-text("Edit")');
    
    expect(page.url()).toContain(`/clients/${clientId}/edit`);
    await expect(page.locator('text=Edit Client')).toBeVisible({
      timeout: 5000,
    });
  });

  test('should load edit page with query params', async () => {
    await page.goto(`${baseUrl}/clients/${clientId}/edit?tab=contact`, {
      waitUntil: 'networkidle',
    });
    
    expect(page.url()).toContain(`/clients/${clientId}/edit?tab=contact`);
    await expect(page.locator('text=Edit Client')).toBeVisible({
      timeout: 5000,
    });
  });

  test('should handle deep-link to edit route on fresh load', async () => {
    // Simulates user bookmarking the edit URL
    await page.goto(
      `${baseUrl}/clients/${clientId}/edit`,
      { waitUntil: 'networkidle' }
    );
    
    // Should not see 404, should see app
    const response = await page.goto(
      `${baseUrl}/clients/${clientId}/edit`,
      { waitUntil: 'networkidle' }
    );
    
    expect(response?.status()).toBeLessThan(400); // No 4xx errors
    await expect(page.locator('text=Edit Client')).toBeVisible({
      timeout: 5000,
    });
  });
});
```

**Run Integration Tests:**
```bash
# Local dev server (w/ Vite SPA routing)
npm run dev --prefix packages/web &
npm run test:e2e --prefix packages/web -- client-edit-route.spec.ts

# Production build (w/ vercel.json rewrites - requires local server)
npm run build --prefix packages/web
npx serve -s packages/web/dist &
npm run test:e2e --prefix packages/web -- client-edit-route.spec.ts

# Against deployed instance
APP_URL=https://mhc-family-portal.vercel.app npm run test:e2e --prefix packages/web -- client-edit-route.spec.ts
```

### 4.3 End-to-End Tests (Manual + Automated)

#### Manual E2E (Smoke Test):
1. **Login** to https://mhc-family-portal.vercel.app
2. **Navigate** to any client list page
3. **Click** on a client card → should load detail page
4. **Click** EDIT button → should load edit form (**BUG WAS HERE: 404**)
5. **Edit** a field (e.g., phone number)
6. **Save** → should see success toast
7. **Navigate** back → client list should reflect changes
8. **Direct URL Test:**
   - Copy edit URL: `https://mhc-family-portal.vercel.app/clients/{id}/edit`
   - Paste in new browser tab
   - Should load without 404 (**BUG WAS HERE**)

#### Automated E2E (Cypress/Playwright):
```bash
npm run test:e2e:prod --prefix packages/web
```

### 4.4 Regression Tests

Test related routes that also use dynamic parameters:

```typescript
test.describe('SPA Dynamic Routes', () => {
  // Test all dynamic routes defined in App.tsx routes that follow the same pattern
  
  test('should load /care-plans/:id/edit', async () => {
    // Same pattern as client edit
  });

  test('should load /invoices/:id/detail', async () => {
    // Same pattern as client edit
  });

  test('should load /caregivers/:id/edit', async () => {
    // Same pattern as client edit
  });

  test('should load /scheduling/:id/detail', async () => {
    // Same pattern as client edit
  });
});
```

---

## 5. DEPLOYMENT SAFETY CONSIDERATIONS

### 5.1 Risk Assessment Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **API routes break** | Low | Critical | Explicit `/api` rewrite ensures APIs still routed to function |
| **Static assets rewritten** | Low | High | Vercel bypasses rewrites for existing files (favicon, JS, CSS) |
| **Infinite redirect loop** | Minimal | Critical | Rewrite (not redirect) prevents loops; index.html is final destination |
| **Cache invalidation issues** | Medium | Medium | Vercel purges edge cache on deploy; no CDN issues |
| **Performance regression** | Low | Medium | One extra file serve on 404s; negligible impact |
| **User experience issues** | Low | Low | URL stays clean; app still loads; no visible change |

### 5.2 Safety Checks Before Deploy

```bash
# 1. Validate JSON syntax
jq empty vercel.json || exit 1

# 2. Check for API route conflicts
grep -E "source.*api" vercel.json | head -5

# 3. Verify index.html exists
test -f packages/web/dist/index.html || exit 1

# 4. Check React app can initialize (look for root div)
grep -q 'id="root"' packages/web/dist/index.html || exit 1

# 5. Ensure no hardcoded paths in dist
grep -r "/clients" packages/web/dist/index.html && echo "⚠ Found hardcoded path"

# 6. Run quick unit tests
npm run test --prefix packages/web -- --run || exit 1

# 7. Check git status before push
git status
```

### 5.3 Deployment Strategy

#### Phase 1: Staging Deploy (Vercel Preview)
```bash
# Push to feature branch
git checkout -b fix/client-edit-404
git add vercel.json
git commit -m "fix: Client edit route 404 on production"
git push origin fix/client-edit-404

# Vercel auto-creates preview deployment
# Test at: https://folk-care-fix-client-edit-404.vercel.app/clients/{id}/edit
# ✅ Verify route loads
# ✅ Verify APIs still work
# ✅ Verify static assets load

# If OK, proceed to prod
```

#### Phase 2: Production Deploy (Merge to main)
```bash
# Create PR, get 1 approval
# Merge to main/develop
git checkout develop
git merge fix/client-edit-404 --no-ff -m "Merge: fix client edit route 404"
git push origin develop

# Vercel auto-deploys
# Wait for "Ready" status
```

#### Phase 3: Verification
```bash
# Monitor for errors
# - Check Vercel analytics/logs
# - Check Sentry for new errors
# - A/B test with users: ask support team to test

# Browser DevTools network tab:
# - /clients/123/edit should return 200 (not 404)
# - index.html should load
# - JS bundles should load
# - API calls should work
```

### 5.4 Rollback Plan

If production issues arise:

```bash
# Immediate: Revert vercel.json
git revert HEAD  # Reverts the mergecommit
git push origin main

# Vercel auto-redeploys old code
# Confirm: monitoring shows errors resolved

# Then: Investigate root cause, fix, and redeploy
```

---

## 6. RISK ASSESSMENT & MITIGATION

### 6.1 Identified Risks

#### Risk 1: API Routes Breaking
**Scenario:** API calls to `/api/clients/123` rewritten to `/index.html`, breaking API

**Probability:** Low (explicitly ordered before catch-all)  
**Impact:** Critical (app cannot save/load data)  
**Mitigation:**
- Keep `/api/:path*` → `/api` rewrite **before** `/:path*` → `/index.html`
- Test API call: `curl https://api.example.com/api/health` should return JSON
- Sentry will alert on API errors

```bash
# Verify API still works post-deploy
curl -s https://mhc-family-portal.vercel.app/api/health | jq
# Expected: { "status": "ok" }
```

#### Risk 2: Static Assets Rewritten
**Scenario:** CSS/JS files rewritten to `/index.html`, breaking page styling

**Probability:** Very Low (Vercel auto-serves existing files)  
**Impact:** High (page looks broken)  
**Mitigation:**
- Vercel only rewrites missing files
- Build output confirms all assets exist:
  ```bash
  ls packages/web/dist/assets/index-*.js packages/web/dist/assets/index-*.css
  ```
- Browser DevTools → Network tab shows assets loading with 200 status

#### Risk 3: Infinite Redirect Loop
**Scenario:** Misconfigured rewrites cause `/index.html` → `/index.html` loop

**Probability:** Minimal (using rewrite, not redirect)  
**Impact:** Critical (page never loads)  
**Mitigation:**
- Rewrite (not redirect) prevents this
- `/:path*` → `/index.html` only happens once; subsequent loads use cached response
- Monitor Vercel function logs for errors

#### Risk 4: Cache Invalidation
**Scenario:** Edge cache serves old routing rules, fix doesn't apply

**Probability:** Low (Vercel auto-purges on deploy)  
**Impact:** Medium (old config persists for minutes)  
**Mitigation:**
- Vercel purges all edge cache on deployment
- If needed, manually: `vercel env pull && vercel deploy --prod --force`
- Cloudflare headers ensure fresh delivery

#### Risk 5: Browser Cache Issues
**Scenario:** User's browser cached old 404 response

**Probability:** Very Low (HTTP 404 not cacheable)  
**Impact:** Low (user can hardrefresh)  
**Mitigation:**
- 404s have `Cache-Control: no-cache`
- User hardrefresh (Cmd+Shift+R) clears if needed
- Provide support guidance if needed

### 6.2 Monitoring & Alerting

#### Post-Deployment Monitoring

```bash
# 1. Sentry Error Monitoring
# Dashboard: https://sentry.io/organizations/yourorg/issues/
# Filter: environment:"production" 
# Should NOT see new "Uncaught ReferenceError: document is not defined" or similar

# 2. Vercel Analytics
# Dashboard: https://vercel.com/dashboard/project/folk-care/analytics
# Monitor: Function duration, Error rate, Requests/min
# Alert if: Error rate > 5% or Function duration > 2s

# 3. Uptime Monitoring (if configured)
# Monitor: https://mhc-family-portal.vercel.app/clients/test/edit
# Should return 200 (not 404)

# 4. Real User Monitoring (Plausible)
# Dashboard: https://plausible.io/
# Monitor: Bounce rate on /clients pages
# Should NOT spike post-deploy

# 5. Custom Logs
tail -f /var/log/vercel/production.log  # (if available)
```

#### Automated Health Checks

```bash
# Add to CI/CD (e.g., GitHub Actions post-deploy)
script "verify-fix.sh":

#!/bin/bash
set -e

echo "🔍 Verifying client edit route fix..."

# Test 1: Route returns 200
status=$(curl -s -o /dev/null -w "%{http_code}" \
  "https://mhc-family-portal.vercel.app/clients/test/edit")
if [ "$status" != "200" ]; then
  echo "❌ Route returned $status (expected 200)"
  exit 1
fi
echo "✅ Route returns 200 OK"

# Test 2: Serves HTML (not JSON or error)
content=$(curl -s "https://mhc-family-portal.vercel.app/clients/test/edit")
if ! echo "$content" | grep -q "<!doctype html>"; then
  echo "❌ Response is not HTML"
  exit 1
fi
echo "✅ Returns valid HTML"

# Test 3: React root exists
if ! echo "$content" | grep -q 'id="root"'; then
  echo "❌ React root div not found"
  exit 1
fi
echo "✅ React root div present"

# Test 4: API still works
api_status=$(curl -s -o /dev/null -w "%{http_code}" \
  "https://mhc-family-portal.vercel.app/api/health")
if [ "$api_status" != "200" ]; then
  echo "❌ API returned $api_status (expected 200)"
  exit 1
fi
echo "✅ API health check OK"

echo ""
echo "🎉 All verification checks passed!"
```

### 6.3 Rollback Decision Tree

```
Deployed vercel.json with rewrite fix
           ↓
   Wait 5 minutes for Vercel to fully propagate
           ↓
   Run verification script above
           ↓
     ┌─────┴──────┐
     ↓            ↓
  PASS       FAIL
     ↓            ↓
Monitor      ❌ Immediate Actions:
 (24h)       - Revert: git revert + push
             - Wait 2 min for Vercel redeploy
             - Run verification again
                   ↓
            ┌──────┴──────┐
            ↓             ↓
         PASS        STILL FAIL
            ↓             ↓
       Continue      🚨 Incident:
       Monitoring   - Page production issue
                    - Check vercel.json syntax
                    - Review error logs
                    - Escalate to DevOps
```

---

## 7. IMPLEMENTATION CHECKLIST

### Pre-Deployment
- [ ] Backup `vercel.json`
- [ ] Validate JSON syntax: `jq empty vercel.json`
- [ ] Build locally: `npm run build --prefix packages/web`
- [ ] Verify `dist/index.html` exists
- [ ] Run unit tests: `npm run test --prefix packages/web`
- [ ] Create feature branch: `git checkout -b fix/client-edit-404`
- [ ] Update `vercel.json` with new rewrites
- [ ] Commit with clear message (see phase 2.3.2)
- [ ] Push to PR, get review

### Deployment
- [ ] Merge to main/develop
- [ ] Confirm Vercel auto-deploy starts
- [ ] Wait for "Ready" status
- [ ] Monitor logs for errors

### Post-Deployment
- [ ] Run verification script (5.4)
- [ ] Test in browser:
  - [ ] Login
  - [ ] Navigate to client card
  - [ ] Click Edit button
  - [ ] Verify form loads (not 404)
  - [ ] Try editing a field
  - [ ] Save
  - [ ] Verify success toast
- [ ] Direct URL test:
  - [ ] Copy an edit URL
  - [ ] Open in new tab
  - [ ] Should load (not 404)
- [ ] API test:
  - [ ] Make an API call from app
  - [ ] Should succeed (not redirected to HTML)
- [ ] Monitor for 24h:
  - [ ] Check Sentry for new errors
  - [ ] Check Vercel analytics
  - [ ] Ask support: any complaints?

### If Issues Occur
- [ ] Run rollback script (6.4)
- [ ] Investigate root cause
- [ ] Create detailed issue report
- [ ] Fix and redeploy

---

## 8. ARCHITECTURE DECISION RECORD (ADR)

**Title:** Use Vercel Rewrite Rules for SPA Routing  
**Status:** Approved  
**Date:** 2024-10-13  
**Context:** Frontend SPA (React + React Router) deployed on Vercel (static-only platform)

### Problem
Dynamic routes like `/clients/:id/edit` exist in React Router but not as static files. Vercel returns 404 for unknown paths, preventing React Router from taking control.

### Solution
Configure Vercel rewrites in `vercel.json` to redirect missing routes to `/index.html`, allowing React Router to parse URLs and render components.

### Alternatives Considered
1. **Hash-based routing** (`/#/clients/:id/edit`): Works everywhere but ugly URLs
2. **Redirect pattern** (404 → `/`): Extra network request, URL change visible to user
3. **API-only routes** (no SPA): Requires server-side templating, less modern

### Decision
**Rewrite with explicit API route protection** chosen because:
- Clean URLs maintained
- Standard SPA deployment pattern
- Minimal performance impact
- Explicit routing rules prevent accidental API rewrites

### Consequences
- **Good:** Modern UX, familiar to SPA developers
- **Good:** Easy to debug (Vercel logs show rewrites)
- **Risk:** Must keep API routes ordered before catch-all
- **Risk:** All unmatched routes serve `index.html` (could hide typos)

---

## 9. REFERENCE & DEBUGGING GUIDE

### 9.1 Vercel Configuration Files

| File | Purpose | Relevance |
|------|---------|-----------|
| `vercel.json` | Deployment config, rewrites, headers | **CRITICAL** - This is what we're fixing |
| `packages/web/vite.config.ts` | Build config | Dev-only; doesn't affect production |
| `packages/web/dist/index.html` | Built SPA | Must exist; served for unmatched routes |
| `packages/web/src/App.tsx` | Route definitions | Defines `/clients/:id/edit` route |
| `api/index.ts` | Serverless function | Handles API requests |

### 9.2 Debugging Commands

```bash
# See what Vercel will serve from dist/
ls -la packages/web/dist/

# Verify rewrite rules syntax
jq '.rewrites' vercel.json

# Check if index.html has required elements
grep -E 'id="root"|type="module"' packages/web/dist/index.html

# Simulate production locally (requires serve package)
npm install -g serve
cd packages/web
serve -s dist
# Visit: http://localhost:3000/clients/test/edit

# Check Vercel deployment status
vercel status

# View Vercel logs
vercel logs --follow

# See what files were deployed
vercel files

# Test API endpoint
curl -v https://mhc-family-portal.vercel.app/api/health

# Test SPA route
curl -v https://mhc-family-portal.vercel.app/clients/123/edit
```

### 9.3 Common Issues & Solutions

| Issue | Symptom | Solution |
|-------|---------|----------|
| **Rewrite to index.html fails** | Still get 404 | Check rewrite rule ordering; API routes must come first |
| **App loads but shows NotFound page** | White page, no form | URL is rewritten correctly but route not defined in App.tsx |
| **API calls fail with HTML response** | GET /api/clients returns `<html>` | API rewrite rule missing or ordered after catch-all |
| **CSS/JS not loading** | Unstyled page | Check build output; `npm run build` must complete successfully |
| **Old content served** | Still seeing old bug | Edge cache; run `vercel deploy --prod --force` |
| **Changes not live** | Local fix works but production unchanged | Vercel needs full redeploy; push to main and wait |

### 9.4 Important URLs for Debugging

```
Production Frontend: https://mhc-family-portal.vercel.app
Vercel Dashboard:    https://vercel.com/dashboard/folk-care
Sentry Errors:       https://sentry.io/organizations/{org}/issues/
Logs:                vercel logs --follow
Test Client Edit:    https://mhc-family-portal.vercel.app/clients/cf1d4348-161a-458f-ac10-9ca9972cf4ed/edit
```

---

## 10. TESTING EVIDENCE (PRE-DEPLOY)

### Local Development Verification

```bash
cd /Users/markjordan/folk-care

# TEST 1: Build succeeds
npm run build --prefix packages/web
# Expected: ✅ No errors, dist/ created with index.html

# TEST 2: index.html exists and has root div
test -f packages/web/dist/index.html && echo "✅ index.html exists"
grep -q 'id="root"' packages/web/dist/index.html && echo "✅ React root exists"

# TEST 3: Serve build output and test route
(cd packages/web && npx serve -s dist &)
sleep 2
curl -s http://localhost:3000/clients/test/edit | grep -q "<!doctype" && echo "✅ Route served"
kill %1  # Kill serve process

# TEST 4: Routes are defined in App.tsx
grep -q '/clients/:id/edit' packages/web/src/App.tsx && echo "✅ Route defined"

# TEST 5: API routes are protected (come before catch-all)
jq '.rewrites[0].source' vercel.json | grep -q "/api" && echo "✅ API rewrite first"
```

---

## 11. FINAL RECOMMENDATIONS

### Immediate Action (Today)
1. **Apply Solution 2** from section 2.2.2 (`/:path*` → `/index.html`)
2. **Merge to production** via main branch
3. **Verify** with manual test (browser, direct URL)
4. **Monitor** for 24 hours

### Short Term (This Sprint)
1. **Add E2E tests** (section 4.2) to prevent regression
2. **Document** this SPA routing pattern for new developers
3. **Add pre-deploy checks** to CI/CD pipeline

### Long Term
1. **Consider Next.js** for file-based routing (eliminates this class of bug)
2. **Setup automated monitoring** for route 404s
3. **Regular audits** of vercel.json for similar issues

---

## 12. APPROVAL & SIGN-OFF

| Role | Name | Date | Status |
|------|------|------|--------|
| Technical Architect | [Your Name] | 2024-10-13 | ✅ Approved |
| Engineering Lead | [Name] | TBD | ⏳ Pending |
| Product Manager | [Name] | TBD | ⏳ Pending |
| QA Lead | [Name] | TBD | ⏳ Pending |

---

**Document Version:** 1.0  
**Last Updated:** 2024-10-13  
**Status:** Ready for Implementation  
**Distribution:** Engineering Team, Product, QA
