#!/usr/bin/env bash
# Boot smoke test: import the compiled API entry point with Node's require(esm) support
# DISABLED, to emulate Vercel's serverless launcher (/opt/rust/nodejs.js).
#
# Why this exists: Node >= 22.12 can require() ES modules, but Vercel's launcher cannot.
# A dependency that ships ESM-only code (e.g. sanitize-html@2.18 -> htmlparser2@12) loads
# fine in local dev and CI, then crashes the deployed function at cold start with
# ERR_REQUIRE_ESM, so EVERY API route returns 500. This script reproduces that failure
# in CI, before a deploy, with the same error.
#
# Requires: `npm run build` (needs packages/app/dist). No database or secrets needed:
# module load is where the failure happens, and createApp() is never called.
set -uo pipefail

cd "$(dirname "$0")/.."

ENTRY="packages/app/dist/src/server.js"
if [[ ! -f "$ENTRY" ]]; then
  echo "✖ $ENTRY not found. Run 'npm run build' first." >&2
  exit 2
fi

# VERCEL=1 skips dotenv loading in server.ts.
export VERCEL=1 NODE_ENV=production

# The loaded app leaves timers/handles open, so exit explicitly. A hard in-process
# deadline keeps this from ever hanging CI (macOS has no `timeout(1)`).
LOADER="$(cat <<'JS'
const entry = process.argv[1];
const deadline = setTimeout(() => {
  console.error('API module graph did not finish loading within 60s');
  process.exit(124);
}, 60_000);
try {
  const m = await import(entry);
  if (typeof m.createApp !== 'function') throw new Error('createApp export missing');
  clearTimeout(deadline);
  console.log('module graph loaded');
  process.exit(0);
} catch (e) {
  console.error(e && e.stack ? e.stack : String(e));
  process.exit(1);
}
JS
)"

OUTPUT="$(node --no-experimental-require-module --input-type=module -e "$LOADER" "./${ENTRY}" 2>&1)"
STATUS=$?

if [[ $STATUS -ne 0 ]]; then
  # Show only the failure, not unrelated load-time noise (e.g. swagger-jsdoc YAML warnings).
  { grep -E "ERR_REQUIRE_ESM|Error|did not finish|createApp export" <<<"$OUTPUT" | head -8; } >&2 || tail -20 <<<"$OUTPUT" >&2
  echo "" >&2
  if grep -q "ERR_REQUIRE_ESM" <<<"$OUTPUT"; then
    echo "✖ ERR_REQUIRE_ESM: a CommonJS dependency require()s an ES module." >&2
    echo "  Vercel's serverless launcher cannot do that, so the deployed API would return 500 on every route." >&2
    echo "  Pin a CommonJS-compatible version via root package.json \"overrides\", or replace the dependency." >&2
  else
    echo "✖ API module graph failed to load (exit $STATUS)." >&2
  fi
  exit 1
fi

echo "✔ API module graph loads with require(esm) disabled, matching Vercel's launcher"
