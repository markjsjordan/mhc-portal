#!/bin/bash
set -e

# Navigate to project root
cd "$(dirname "$0")/.."

# Source environment
if [ -f .secrets.txt ]; then
  set -a
  source .secrets.txt
  set +a
fi

# Build if needed (only build app package)
cd packages/app && npm run build > /dev/null 2>&1 || true
cd ../..

# Run the compiled cronjob
node packages/app/dist/src/cron/clickup-poll.js
