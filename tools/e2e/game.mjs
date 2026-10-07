// Runs every game e2e script in tools/e2e/game/ in alphabetical order (docs/GAME_DESIGN.md §15.1 rule 7).
// Each slice drops its own scripts into that folder (`game-loop.mjs`, `clock.mjs`, `shops.mjs`, ...) and never edits this runner.
// Usage: node tools/e2e/game.mjs [filter ...]   (the dev server must be running for scripts that open the app; BASE overrides the URL)
//   - a script is a `.mjs` file; names that start with `_` or `.` are shared helpers and are not run
//   - every script runs in its own node process, so one crash cannot hide another; the exit code is 1 if any script failed
//   - with a filter, only scripts whose name contains one of the words run
import { readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('./game/', import.meta.url));
const filters = process.argv.slice(2).filter((a) => !a.startsWith('-'));

const scripts = (existsSync(dir) ? readdirSync(dir) : [])
  .filter((name) => name.endsWith('.mjs') && !name.startsWith('_') && !name.startsWith('.'))
  .filter((name) => filters.length === 0 || filters.some((f) => name.includes(f)))
  // plain code-unit order, not locale order: the same run order on every machine
  .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

if (scripts.length === 0) {
  console.log('no game e2e scripts yet');
  process.exit(0);
}

const results = [];
for (const name of scripts) {
  console.log(`\n=== game e2e: ${name} ===`);
  const started = Date.now();
  const r = spawnSync(process.execPath, [`${dir}${name}`], { stdio: 'inherit', env: process.env });
  const ok = r.status === 0 && r.signal === null && !r.error;
  if (r.error) console.error(`could not start ${name}: ${r.error.message}`);
  results.push({ name, ok, ms: Date.now() - started, why: r.signal ? `signal ${r.signal}` : `exit ${r.status}` });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
}

console.log('\ngame e2e summary');
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `  (${r.why})`}`);
const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length === 0 ? 0 : 1);
