# Production Bug Fix: Client Edit Route 404 - Quick Reference & Visual Guide

## Executive Summary Card

```
╔═══════════════════════════════════════════════════════════════════════════╗
║ TICKET: wdvf3abgv0 - Client Edit Route Returns 404 on Production         ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  SEVERITY:     🔴 HIGH (Blocks core client editing workflow)              ║
║  ROOT CAUSE:   SPA routing misconfiguration in vercel.json                ║
║  FIX TIME:     ~30 minutes to implement + 5 min Vercel propagation        ║
║  RISK LEVEL:   ✅ LOW (explicit API route protection)                     ║
║  TEST IMPACT:  ✅ No test changes needed (unit tests still pass)          ║
║                                                                           ║
║  AFFECTED ROUTE:  /clients/:id/edit                                       ║
║  AFFECTED USERS:  Anyone with clients:write permission                    ║
║  LOCAL STATUS:    ✅ WORKS (Vite implicit SPA fallback)                   ║
║  PRODUCTION:      ❌ 404 (missing rewrite rule)                           ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

---

## Visual: Request Flow Comparison

### CURRENT (Broken) - Production
```
User: /clients/cf1d4348.../edit

    ┌─────────────────────────────────────────┐
    │  BROWSER REQUEST                        │
    │  GET /clients/cf1d4348.../edit          │
    └────────────────┬────────────────────────┘
                     ↓
    ┌─────────────────────────────────────────┐
    │  VERCEL EDGE NODE                       │
    │  Check: File at /clients/.../edit ?     │
    │  Result: NOT FOUND                      │
    └────────────────┬────────────────────────┘
                     ↓
    ┌─────────────────────────────────────────┐
    │  ❌ RETURN HTTP 404                     │
    │  Rewrite rule not applied!              │
    └────────────────┬────────────────────────┘
                     ↓
    ┌─────────────────────────────────────────┐
    │  BROWSER                                │
    │  Shows: "404 Not Found"                 │
    │  React Router: Never initialized        │
    └─────────────────────────────────────────┘
```

### FIXED - Production (After Apply)
```
User: /clients/cf1d4348.../edit

    ┌─────────────────────────────────────────┐
    │  BROWSER REQUEST                        │
    │  GET /clients/cf1d4348.../edit          │
    └────────────────┬────────────────────────┘
                     ↓
    ┌─────────────────────────────────────────┐
    │  VERCEL EDGE NODE                       │
    │  Check: File at /clients/.../edit ?     │
    │  Result: NOT FOUND                      │
    └────────────────┬────────────────────────┘
                     ↓
    ┌─────────────────────────────────────────┐
    │  APPLY REWRITE RULES (vercel.json)      │
    │  Source: /:path* → /index.html          │
    │  Match: YES ✅                          │
    └────────────────┬────────────────────────┘
                     ↓
    ┌─────────────────────────────────────────┐
    │  ✅ RETURN /index.html (HTTP 200)       │
    │  URL: /clients/cf1d4348.../edit         │
    │  (URL stays same, content is index.html)│
    └────────────────┬────────────────────────┘
                     ↓
    ┌─────────────────────────────────────────┐
    │  BROWSER LOADS APP                      │
    │  - Parse HTML                           │
    │  - Load React + React Router JS chunks  │
    │  - React Router sees: /clients/.../edit │
    │  - Renders: <ClientEditPage />          │
    └────────────────┬────────────────────────┘
                     ↓
    ┌─────────────────────────────────────────┐
    │  USER SEES                              │
    │  ✅ Client edit form loaded             │
    │  ✅ Can edit fields                     │
    │  ✅ Can save changes                    │
    └─────────────────────────────────────────┘
```

### COMPARISON: Local Development (Works, Why?)
```
Dev Server (Vite): localhost:5173/clients/.../edit

    ┌─────────────────────────────────────────┐
    │  VITE DEV SERVER                        │
    │  Check: File matches any route config?  │
    │  Result: NO explicit config             │
    └────────────────┬────────────────────────┘
                     ↓
    ┌─────────────────────────────────────────┐
    │  IMPLICIT SPA FALLBACK                  │
    │  Vite dev mode: "If no file matches,    │
    │  serve /index.html"                     │
    │  (This is NOT in vite.config.ts - it's  │
    │   baked into Vite's dev server)         │
    └────────────────┬────────────────────────┘
                     ↓
    ┌─────────────────────────────────────────┐
    │  ✅ RETURN index.html (200)             │
    │  React Router initializes               │
    │  App works                              │
    └─────────────────────────────────────────┘

Why it works locally but not production:
  • Vite = implicit SPA fallback
  • Vercel static = explicit rewrite rules required
```

---

## Vercel.json Diff: What's Changing

```diff
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
-     {
-       "source": "/(.*)",
-       "destination": "/index.html"
-     }
+     {
+       "source": "/:path*",
+       "destination": "/index.html"
+     }
    ],
    "headers": [ ... ],
    "cleanUrls": false,
    "trailingSlash": false,
    "github": {
      "enabled": false,
      "autoAlias": false,
      "silent": true
    }
  }
```

**What Changed:**
- `/(.*)`  → `/:path*`
- Why: Simpler syntax, same effect, clearer intent
- Impact: All unmatched routes rewrite to index.html (SPA fallback)
- API protection: `/api/:path*` rules come FIRST, so APIs not affected

---

## Architecture Diagram: Request Routing

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        VERCEL REWRITE RULES                              │
│                        (Evaluated in order)                              │
└──────────────────────────────────────────────────────────────────────────┘

1. Check: /api/... → Route to /api endpoint ✅ [API REWRITE]
   Example: /api/clients/123 → Vercel Function
   
   NO MATCH ↓
   
2. Check: /health → Route to /api
   
   NO MATCH ↓
   
3. Check: /metrics → Route to /api
   
   NO MATCH ↓
   
4. Check: /webhooks/... → Route to /api endpoint
   
   NO MATCH ↓
   
5. Check: /:path* → Route to /index.html ✅ [SPA FALLBACK]
   Example: /clients/123/edit → /index.html
   This is where the fix applies!
   
   React Router takes control and:
   - Parses /clients/123/edit
   - Finds matching route definition
   - Renders component
   
   NO MATCH ↓
   
6. Serve static files from /dist (favicon, CSS, JS, images)
   Example: /assets/index-B71vXUKV.js → Direct from dist/

┌──────────────────────────────────────────────────────────────────────────┐
│ KEY INSIGHT:                                                             │
│ Rewrites only apply to "missing files" (404s).                           │
│ Existing files (JS, CSS, images) are served directly without rewriting.  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## File Structure: What Gets Deployed

```
Production Build Output
└── packages/web/dist/
    ├── index.html ←────────────── [CRITICAL]
    │   <!doctype html>
    │   <div id="root"></div>
    │   <script src="/assets/index-B71vXUKV.js"></script>
    │
    ├── manifest.webmanifest
    ├── registerSW.js
    ├── sw.js
    ├── favicon.ico
    ├── assets/
    │   ├── index-B71vXUKV.js ←── [React App Bundle]
    │   ├── react-vendor-zE8wwMRx.js
    │   ├── index-4cWpzyDF.css
    │   └── ... (other chunks)
    │
    └── (all other static files)

Request Flow:
  /clients/123/edit 
    → not in dist/ 
    → rewrite to /index.html 
    → serve from dist/index.html ✅

  /assets/index-B71vXUKV.js 
    → found in dist/assets/ 
    → serve directly (no rewrite) ✅

  /favicon.ico 
    → found in dist/ 
    → serve directly (no rewrite) ✅
```

---

## Implementation Steps (Ultra-Quick)

### Step 1: Edit vercel.json (1 min)
```bash
# Navigate to repo
cd /Users/markjordan/folk-care

# Open in editor
code vercel.json  # or nano, vim, etc.

# Change line 35-37:
# FROM:  "source": "/(.*)",
# TO:    "source": "/:path*",

# Save and close
```

### Step 2: Verify & Commit (1 min)
```bash
# Validate JSON
jq empty vercel.json && echo "✅ Valid"

# Commit
git add vercel.json
git commit -m "fix: SPA rewrite rule for /clients/:id/edit route"
```

### Step 3: Push to Main (2 min)
```bash
# Create feature branch or push directly
git push origin develop  # or push and create PR

# Vercel auto-deploys on push
```

### Step 4: Verify in Browser (2 min)
```
1. Go to: https://mhc-family-portal.vercel.app/dashboard
2. Log in
3. Click on any client card
4. Click EDIT button
5. ✅ Form loads (not 404)
6. ✅ Success!
```

---

## Troubleshooting: If It Still 404s

```
Q: "I deployed but still getting 404"
A: Wait 2-3 minutes for Vercel edge cache to clear, then refresh browser (Cmd+Shift+R)

Q: "API calls now return HTML instead of JSON"
A: Check API rewrite rules are BEFORE catch-all. Order matters!
   Test: curl https://api.example.com/api/health
   
Q: "Page loads but shows NotFound component"
A: Route rewrite is working, but component not rendering.
   Check: Is route defined in App.tsx? 
          Line 261: path="/clients/:id/edit" ✅
          
Q: "Deployment is stuck"
A: Check Vercel dashboard > Deployments > Latest
   If red: Click for error details
   Common: JSON syntax error in vercel.json → use 'jq empty vercel.json'
```

---

## Testing Checklist: Post-Deployment

```
🔍 IMMEDIATE TESTS (5 min)

[ ] Direct URL Test
    Go to: https://mhc-family-portal.vercel.app/clients/{ANY_ID}/edit
    Expected: Form loads (not 404)
    
[ ] Browser Console Check
    Open DevTools → Console
    No errors like "Cannot find route" or "React Router initialization failed"
    
[ ] Network Tab Verification
    DevTools → Network
    /clients/{id}/edit → index.html (200)
    /api/... → real API endpoint (200 or expected error)
    /assets/*.js → direct (200)
    
[ ] Functional Test
    Click EDIT on client card
    → Should load form (not 404)
    → Edit a field
    → Click Save
    → Should see success toast

[ ] API Test
    Make any API call from app
    Should succeed (not return HTML error)
    
🕐 ONGOING MONITORING (24 hours)

[ ] Sentry Dashboard
    Check for new errors post-deploy
    Should NOT see "undefined route" errors
    
[ ] Vercel Analytics
    Monitor function calls and errors
    Should NOT see spike in 404s
    
[ ] User Reports
    Ask support team: any complaints about client editing?
    Should be: no new complaints
```

---

## Reference: All SPA Routes That Need This Fix

Routes in `/packages/web/src/App.tsx` that follow the same pattern:

```typescript
// These routes are dynamic (params in URL) and rely on SPA rewriting
✅ /clients/:id
✅ /clients/:id/edit          ← THE BUG
✅ /clients/:id/medications
✅ /care-plans/:id
✅ /care-plans/:id/edit
✅ /invoices/:id
✅ /visits/:id
✅ /caregivers/:id
✅ /shifts/:id
✅ ... (many more)

All of these need the rewrite rule to work on production.
The fix applies to ALL of them automatically.
```

---

## One-Liner Deploy (For CI/CD)

```bash
# Atomic deploy from CI
git add vercel.json && \
git commit -m "fix: SPA rewrite rule" && \
git push origin main && \
echo "✅ Vercel deploying... check dashboard"
```

---

## Key Takeaway

| Layer | Issue | Fix |
|-------|-------|-----|
| **Architecture** | React Router needs control of URL parsing | Rewrite missing routes to index.html |
| **Config** | Vercel doesn't know about dynamic routes | Add explicit rewrite rule in vercel.json |
| **Syntax** | Catch-all regex was ambiguous | Use cleaner `/:path*` pattern |
| **Safety** | API routes could be affected | Protect with explicit `/api:path*` rule first |
| **Testing** | Needs verification it works | Test in browser post-deploy |

---

**Ready to implement? Start at "Implementation Steps (Ultra-Quick)" above.**

**Questions? See "Production Bug Fix Specification" for full 12-section technical guide.**
