# Implementation-Ready Code: Client Edit Route 404 Fix

> **TL;DR:** Change line 35 of `vercel.json` from `"source": "/(.*)"` to `"source": "/:path*"` and deploy.

---

## File: `vercel.json` - COMPLETE FIXED VERSION

Copy the entire content below and replace your current `vercel.json`:

```json
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
```

---

## Exact Changes Made

```diff
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api" },
    { "source": "/health", "destination": "/api" },
    { "source": "/metrics", "destination": "/api" },
    { "source": "/webhooks/:path*", "destination": "/api" },
-   { "source": "/(.*)", "destination": "/index.html" }
+   { "source": "/:path*", "destination": "/index.html" }
  ]
```

**Line Changed:** 35 (in rewrites array)  
**From:** `"source": "/(.*)"` (regex catch-all)  
**To:** `"source": "/:path*"` (Vercel param syntax)

---

## Deploy Script

Save as `deploy-fix.sh` and run:

```bash
#!/bin/bash
set -e

cd /Users/markjordan/folk-care

echo "🔧 Deploying client edit route fix..."

# 1. Backup original
cp vercel.json vercel.json.backup
echo "✅ Backup created: vercel.json.backup"

# 2. Apply fix (copy the fixed JSON above into vercel.json)
# [Manually edit or use cat heredoc below]

# 3. Validate
jq empty vercel.json
echo "✅ JSON syntax valid"

# 4. Verify change
if grep -q '"source": "/:path\*"' vercel.json; then
  echo "✅ Fix applied correctly"
else
  echo "❌ Fix not applied. Reverting."
  mv vercel.json.backup vercel.json
  exit 1
fi

# 5. Commit
git add vercel.json
git commit -m "fix: SPA rewrite rule for dynamic routes (fixes /clients/:id/edit 404)

- Changed catch-all rewrite from /(.*) to /:path*
- Ensures dynamic routes like /clients/:id/edit rewrite to index.html
- Fixes ticket wdvf3abgv0: Client edit route 404 on production
- No API routes affected (protected by explicit /api rewrite)
- All SPA routes now work on production"

echo "✅ Committed to git"

# 6. Deploy
git push origin develop
echo "✅ Pushed to develop"
echo ""
echo "🚀 Deployment in progress on Vercel..."
echo "📊 Check status: https://vercel.com/dashboard"
echo "🌐 Test at: https://mhc-family-portal.vercel.app/clients/{id}/edit"
```

**Run:**
```bash
chmod +x deploy-fix.sh
./deploy-fix.sh
```

---

## Bash One-Liner (If you prefer)

```bash
cd /Users/markjordan/folk-care && \
cp vercel.json vercel.json.backup && \
sed -i '' 's/"source": "\/\(\.\*\)"/"source": "\/:path*"/g' vercel.json && \
jq empty vercel.json && \
git add vercel.json && \
git commit -m "fix: SPA rewrite rule for /clients/:id/edit 404" && \
git push origin develop && \
echo "✅ Fix deployed!"
```

---

## Python Script (For CI/CD)

```python
#!/usr/bin/env python3
"""
Deploy fix for client edit route 404
Usage: python deploy_fix.py
"""

import json
import subprocess
import sys
from pathlib import Path

def main():
    repo_root = Path("/Users/markjordan/folk-care")
    vercel_json = repo_root / "vercel.json"
    
    # 1. Backup
    backup = repo_root / "vercel.json.backup"
    backup.write_text(vercel_json.read_text())
    print("✅ Backup created")
    
    # 2. Load and modify
    config = json.loads(vercel_json.read_text())
    
    # Find and fix the catch-all rewrite
    for rewrite in config["rewrites"]:
        if rewrite["source"] == "/(.*)" and rewrite["destination"] == "/index.html":
            rewrite["source"] = "/:path*"
            print("✅ Rewrite rule updated")
            break
    else:
        print("❌ Could not find rewrite rule to fix")
        return 1
    
    # 3. Write back
    vercel_json.write_text(json.dumps(config, indent=2) + "\n")
    print("✅ File written")
    
    # 4. Validate
    try:
        json.loads(vercel_json.read_text())
        print("✅ JSON valid")
    except json.JSONDecodeError as e:
        print(f"❌ JSON invalid: {e}")
        return 1
    
    # 5. Git commit and push
    subprocess.run(["git", "add", "vercel.json"], cwd=repo_root, check=True)
    subprocess.run(
        ["git", "commit", "-m", "fix: SPA rewrite rule for dynamic routes"],
        cwd=repo_root,
        check=True,
    )
    subprocess.run(
        ["git", "push", "origin", "develop"],
        cwd=repo_root,
        check=True,
    )
    print("✅ Deployed to Vercel")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

**Run:**
```bash
python3 deploy_fix.py
```

---

## Manual Edit Instructions (Copy-Paste Safe)

**If you want to edit manually:**

1. **Open:** `vercel.json` in your editor
2. **Find:** Line starting with `"source": "/(.*)",` (around line 35)
3. **Replace:** The entire object with:
   ```json
   {
     "source": "/:path*",
     "destination": "/index.html"
   }
   ```
4. **Save**
5. **Verify:** Run `jq empty vercel.json` (should output nothing if valid)
6. **Commit:**
   ```bash
   git add vercel.json
   git commit -m "fix: SPA rewrite rule"
   git push origin develop
   ```

---

## Post-Deploy Verification Script

Save as `verify-fix.sh`:

```bash
#!/bin/bash

PROD_URL="https://mhc-family-portal.vercel.app"
TEST_CLIENT_ID="cf1d4348-161a-458f-ac10-9ca9972cf4ed"

echo "🔍 Verifying client edit route fix..."
echo ""

# Wait for Vercel to propagate (it's usually < 1 min, but we'll wait)
echo "⏳ Waiting 30 seconds for Vercel edge cache to clear..."
sleep 30

# Test 1: Route returns 200
echo "Test 1: HTTP Status"
status=$(curl -s -o /dev/null -w "%{http_code}" \
  "$PROD_URL/clients/$TEST_CLIENT_ID/edit")
if [ "$status" == "200" ]; then
  echo "  ✅ Returns HTTP 200"
else
  echo "  ❌ Returns HTTP $status (expected 200)"
  exit 1
fi

# Test 2: Response contains HTML
echo "Test 2: Response Content"
content=$(curl -s "$PROD_URL/clients/$TEST_CLIENT_ID/edit")
if echo "$content" | grep -q "<!doctype html>"; then
  echo "  ✅ Returns valid HTML"
else
  echo "  ❌ Does not return HTML"
  exit 1
fi

# Test 3: React root exists
echo "Test 3: React Root"
if echo "$content" | grep -q 'id="root"'; then
  echo "  ✅ React root div present"
else
  echo "  ❌ React root div not found"
  exit 1
fi

# Test 4: JS bundle loads
echo "Test 4: JS Bundle"
if echo "$content" | grep -q "index-.*\\.js"; then
  echo "  ✅ JS bundle script present"
else
  echo "  ❌ JS bundle not found"
  exit 1
fi

# Test 5: API still works
echo "Test 5: API Health"
api_status=$(curl -s -o /dev/null -w "%{http_code}" \
  "$PROD_URL/api/health")
if [ "$api_status" == "200" ]; then
  echo "  ✅ API health check OK"
else
  echo "  ❌ API returned HTTP $api_status"
  exit 1
fi

echo ""
echo "🎉 All verification checks passed!"
echo ""
echo "Next steps:"
echo "  1. Open browser: $PROD_URL/dashboard"
echo "  2. Navigate to a client"
echo "  3. Click EDIT button"
echo "  4. Verify form loads (not 404)"
```

**Run after deployment:**
```bash
chmod +x verify-fix.sh
./verify-fix.sh
```

---

## Rollback (If Needed)

```bash
cd /Users/markjordan/folk-care

# Option 1: Restore from backup
cp vercel.json.backup vercel.json
git add vercel.json
git commit -m "revert: SPA rewrite rule fix"
git push origin develop

# Option 2: Git revert
git revert HEAD
git push origin develop

# Vercel auto-redeploys within 1-2 minutes
```

---

## Summary Table

| Step | Command | Time | Check |
|------|---------|------|-------|
| 1 | Backup | <1s | `ls vercel.json.backup` |
| 2 | Edit line 35 | <1s | `grep "/:path\*" vercel.json` |
| 3 | Validate JSON | <1s | `jq empty vercel.json` |
| 4 | Git add + commit | <1s | `git status` |
| 5 | Git push | ~5s | `git log -1 --oneline` |
| 6 | Vercel deploys | 1-2min | Check dashboard |
| 7 | Verify fix | ~1min | `./verify-fix.sh` |
| **Total** | | **~3-5 min** | ✅ Fix live |

---

## Success Criteria (Post-Deploy)

- [ ] No HTTP 404 when accessing `/clients/:id/edit`
- [ ] Direct URL access works: paste `/clients/{id}/edit` in browser → loads form
- [ ] Navigation works: click EDIT button on client card → loads form
- [ ] API works: form can fetch and save data
- [ ] No new Sentry errors post-deploy
- [ ] No uptick in error rate on Vercel dashboard

---

**Ready to deploy? Execute the script that matches your workflow (bash, Python, or manual).**

**Questions? See PROD_BUG_404_EDIT_ROUTE_SPEC.md for full technical details.**
