#!/usr/bin/env node
/**
 * Fail if the built web app has static import cycles between JS chunks.
 *
 * ES module cycles between manualChunks cause startup TDZ crashes
 * ("Cannot access 'X' before initialization", "Cannot set properties of undefined")
 * that leave a blank page and are invisible to build, typecheck and unit tests.
 * (wdvf3ad44t: #162 split verticals/ui-libs into chunks that imported each other.)
 *
 * Usage: node scripts/check-chunk-cycles.mjs [dist/assets]
 * Exit 0 = no inter-chunk static cycles. Exit 1 = cycles found. Exit 2 = nothing to check.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const assets = resolve(process.argv[2] ?? 'dist/assets');
let files;
try {
  files = readdirSync(assets).filter((f) => f.endsWith('.js'));
} catch {
  console.error(`check-chunk-cycles: cannot read ${assets}`);
  process.exit(2);
}
if (files.length === 0) {
  console.error(`check-chunk-cycles: no .js files in ${assets}`);
  process.exit(2);
}

const fileSet = new Set(files);
const staticRe = /(?:from|import)\s*"\.\/([^"]+\.js)"/g;
const dynamicRe = /import\("\.\/([^"]+\.js)"\)/g;

const deps = new Map();
for (const f of files) {
  const src = readFileSync(join(assets, f), 'utf8');
  const dynamic = new Set([...src.matchAll(dynamicRe)].map((m) => m[1]));
  const targets = new Set();
  for (const m of src.matchAll(staticRe)) {
    const t = m[1];
    if (t !== f && fileSet.has(t) && !dynamic.has(t)) targets.add(t);
  }
  deps.set(f, targets);
}

const label = (f) => f.replace(/-[A-Za-z0-9_-]{8}\.js$/, '');
const state = new Map();
const cycles = new Set();

const visit = (start) => {
  // Iterative DFS: 100+ chunks, avoid deep recursion limits.
  const stack = [{ node: start, it: deps.get(start).values() }];
  const path = [start];
  state.set(start, 1);
  while (stack.length > 0) {
    const top = stack[stack.length - 1];
    const next = top.it.next();
    if (next.done) {
      state.set(top.node, 2);
      stack.pop();
      path.pop();
      continue;
    }
    const v = next.value;
    if (state.get(v) === 1) {
      const cyc = path.slice(path.indexOf(v)).map(label);
      if (new Set(cyc).size > 1) cycles.add(cyc.join(' -> '));
    } else if (state.get(v) === undefined) {
      state.set(v, 1);
      path.push(v);
      stack.push({ node: v, it: deps.get(v).values() });
    }
  }
};

for (const f of files) if (state.get(f) === undefined) visit(f);

if (cycles.size > 0) {
  console.error(`check-chunk-cycles: FAIL, ${cycles.size} static chunk cycle(s):`);
  for (const c of [...cycles].sort()) console.error(`  ${c} -> (back)`);
  console.error('Remove the manualChunks entry that groups these modules (see packages/web/vite.config.ts).');
  process.exit(1);
}
console.log(`check-chunk-cycles: OK, ${files.length} chunks, no static inter-chunk cycles`);
