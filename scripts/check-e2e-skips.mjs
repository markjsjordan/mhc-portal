#!/usr/bin/env node
/**
 * CI/Lint Gate: Prevent new bare `test.skip(` calls in e2e/tests/.
 *
 * Every `test.skip(` in e2e/tests/ MUST be an environment-capability skip
 * annotated with `// e2e-allow-skip: <reason>` on the same line or the
 * immediately preceding line, and documented in e2e/README.md.
 *
 * Comments that merely mention `test.skip(` (e.g. historical notes) are ignored.
 */

import fs from 'node:fs';
import path from 'node:path';

const TESTS_DIR = path.resolve(process.cwd(), 'e2e/tests');
const ALLOW_MARKER = 'e2e-allow-skip:';

function collectSpecFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSpecFiles(full));
    } else if (entry.isFile() && /\.(spec|test)\.(ts|mts|js|mjs)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

const violations = [];

for (const file of collectSpecFiles(TESTS_DIR)) {
  const rel = path.relative(process.cwd(), file);
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Ignore single-line comments or block-comment continuation lines
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue;
    }

    // Strip inline trailing comment before checking for executable test.skip(
    const codePart = line.replace(/\/\/.*$/, '');
    if (!/\btest\.skip\s*\(/.test(codePart)) {
      continue;
    }

    const prevLine = i > 0 ? lines[i - 1] : '';
    const hasAllowMarker = line.includes(ALLOW_MARKER) || prevLine.includes(ALLOW_MARKER);

    if (!hasAllowMarker) {
      violations.push(`${rel}:${i + 1}: ${trimmed}`);
    }
  }
}

if (violations.length > 0) {
  console.error(
    `ERROR: Found ${violations.length} unapproved bare test.skip() call(s) in e2e/tests/:\n` +
      violations.map((v) => `  - ${v}`).join('\n') +
      `\n\nTests must create their own data via e2e/fixtures/factories.ts and fail loudly when setup fails.\n` +
      `Only environment-capability skips are allowed, annotated with "// ${ALLOW_MARKER} <reason>" and listed in e2e/README.md.`
  );
  process.exit(1);
}

console.log('OK: No unapproved bare test.skip() calls found in e2e/tests/.');
