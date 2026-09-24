#!/usr/bin/env node
/**
 * deploy.js — deploy the Worker, optionally binding a specific D1 database id.
 *
 * Usage:
 *   node scripts/deploy.js                     # normal deploy (auto-provision
 *                                              #  or ${D1_DATABASE_ID} interpolation)
 *   node scripts/deploy.js --d1 <database-id>  # inject this id into the binding first
 *   D1_DATABASE_ID=<id> node scripts/deploy.js # same, via env var
 *
 * Via package.json you can run:  pnpm deploy:worker --d1 "<id>"
 *
 * WHY inject into wrangler.toml instead of just interpolating?
 * `${D1_DATABASE_ID}` interpolation only works if that env var is present at
 * deploy time. In Workers Builds, if you forget to add it under
 * Settings → Build → Environment variables, it resolves to empty and D1 breaks
 * ("database with id ... not found"). Writing the id directly into the binding
 * guarantees it is present for THIS deploy. Cloudflare then LINKS that database
 * to your Worker, and the link persists across future deploys even if the id is
 * no longer in the config — so you only need to pass --d1 once.
 *
 * This script never touches JWT_SECRET. Auth secrets must be stable (see
 * scripts/gen-jwt-secret.js), so they are handled separately and idempotently.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';

const TOML = 'wrangler.toml';

function arg(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

function log(m) { console.log(`[deploy] ${m}`); }

// Resolve the D1 id: --d1 flag wins, else D1_DATABASE_ID env, else none.
const d1Id = arg('--d1') || process.env.D1_DATABASE_ID || '';

if (d1Id) {
  if (!/^[0-9a-fA-F-]{16,}$/.test(d1Id)) {
    console.error(`[deploy] ✗ "${d1Id}" doesn't look like a D1 database id (expected a UUID).`);
    process.exit(1);
  }
  if (!existsSync(TOML)) {
    console.error(`[deploy] ✗ ${TOML} not found (run from project root / build root dir).`);
    process.exit(1);
  }
  let toml = readFileSync(TOML, 'utf-8');
  const before = toml;

  // If the id is already set to exactly this value, we're done (idempotent).
  if (new RegExp(`database_id\\s*=\\s*"${d1Id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).test(toml)) {
    log(`database_id already set to ${d1Id} — nothing to change.`);
  } else if (/database_id\s*=\s*"[^"]*"/.test(toml)) {
    // Set the value of the existing `database_id = "..."` line (empty, a prior
    // id, or a ${VAR} placeholder). Works regardless of line endings.
    toml = toml.replace(/database_id\s*=\s*"[^"]*"/, `database_id = "${d1Id}"`);
  } else if (/database_name\s*=\s*"botion-db"/.test(toml)) {
    // No database_id line at all — add one right after database_name.
    toml = toml.replace(/(database_name\s*=\s*"botion-db"[^\n]*\n)/, `$1database_id = "${d1Id}"\n`);
  } else {
    console.error('[deploy] ✗ could not locate a database_id line or the botion-db binding in wrangler.toml.');
    console.error('[deploy]   The [[d1_databases]] block should contain: database_id = ""');
    process.exit(1);
  }

  if (toml !== before) {
    writeFileSync(TOML, toml);
  }
  log(`D1 database_id: ${d1Id}`);
  // Echo the resulting line so the build log confirms the value.
  const line = toml.split(/\r?\n/).find((l) => /^\s*database_id\s*=/.test(l));
  log(`wrangler.toml now has: ${line?.trim()}`);
  log('This deploy links the DB to the Worker; the link persists on future deploys.');
} else {
  log('No --d1 / D1_DATABASE_ID given — using empty database_id (wrangler auto-provisions botion-db).');
}

// Build the frontend so [assets].directory (client/dist) exists before deploy.
// Workers Builds runs this deploy command; without it, wrangler errors that the
// assets directory does not exist.
log('Building frontend (client/dist)...');
const build = spawnSync('node', ['scripts/build-client.js'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=4096' },
});
if ((build.status ?? 1) !== 0) {
  console.error('[deploy] ✗ frontend build failed; aborting deploy.');
  process.exit(build.status ?? 1);
}

// Run the real deploy. Pass through any extra args after our own.
log('Running: wrangler deploy');
const res = spawnSync('npx', ['wrangler', 'deploy'], { stdio: 'inherit' });
process.exit(res.status ?? 1);
