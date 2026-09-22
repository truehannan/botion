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
    console.error(`[deploy] ✗ ${TOML} not found (run from project root).`);
    process.exit(1);
  }
  let toml = readFileSync(TOML, 'utf-8');
  // Replace the database_id value inside the botion-db block (handles the
  // ${D1_DATABASE_ID} placeholder or any prior value).
  const blockRe = /(\[\[d1_databases\]\][\s\S]*?)(?=\n\[\[|\n\[|$)/g;
  let replaced = false;
  toml = toml.replace(blockRe, (block) => {
    if (!/database_name\s*=\s*"botion-db"/.test(block)) return block;
    replaced = true;
    if (/database_id\s*=\s*"[^"]*"/.test(block)) {
      return block.replace(/(database_id\s*=\s*")[^"]*(")/, `$1${d1Id}$2`);
    }
    return block.replace(/(database_name\s*=\s*"[^"]*"\s*\n)/, `$1database_id = "${d1Id}"\n`);
  });
  if (!replaced) {
    console.error('[deploy] ✗ could not find the botion-db [[d1_databases]] block.');
    process.exit(1);
  }
  writeFileSync(TOML, toml);
  log(`Injected D1 database_id into ${TOML}: ${d1Id}`);
  log('This deploy links the DB to the Worker; the link persists on future deploys.');
} else {
  log('No --d1 / D1_DATABASE_ID given — relying on auto-provisioning or ${D1_DATABASE_ID} interpolation.');
}

// Run the real deploy. Pass through any extra args after our own.
log('Running: wrangler deploy');
const res = spawnSync('npx', ['wrangler', 'deploy'], { stdio: 'inherit' });
process.exit(res.status ?? 1);
