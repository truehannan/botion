#!/usr/bin/env node
/**
 * gen-jwt-secret.js — set the Worker's JWT_SECRET exactly ONCE, idempotently.
 *
 *   node scripts/gen-jwt-secret.js            # set only if not already set
 *   node scripts/gen-jwt-secret.js --force    # rotate (INVALIDATES all tokens)
 *   node scripts/gen-jwt-secret.js --print    # just print a fresh secret, set nothing
 *
 * WHY idempotent? JWT_SECRET signs auth tokens. If it changes, EVERY existing
 * user token becomes invalid and everyone is logged out. So this must be
 * generated once and then stay stable — it is NOT part of the build/deploy
 * command. Run it a single time during initial setup.
 *
 * The secret is a 64-char hex (256-bit) value from a CSPRNG. It is written as a
 * Wrangler secret via `wrangler secret put`, never printed to logs or committed.
 */
import { randomBytes } from 'crypto';
import { spawnSync } from 'child_process';

const FORCE = process.argv.includes('--force');
const PRINT_ONLY = process.argv.includes('--print');

function log(m) { console.log(`[jwt] ${m}`); }

function genSecret() {
  return randomBytes(32).toString('hex'); // 256-bit
}

if (PRINT_ONLY) {
  process.stdout.write(genSecret() + '\n');
  process.exit(0);
}

// Check whether JWT_SECRET already exists so we don't rotate it by accident.
function secretExists() {
  const res = spawnSync('npx', ['wrangler', 'secret', 'list'], {
    encoding: 'utf-8',
    env: { ...process.env, CI: '1' },
  });
  if (res.status !== 0 || !res.stdout) return null; // unknown (not authed / error)
  return /"?JWT_SECRET"?/.test(res.stdout);
}

const exists = secretExists();

if (exists === null) {
  log('Could not check existing secrets (wrangler not authenticated?).');
  log('Run `wrangler login`, or set it manually: `wrangler secret put JWT_SECRET`.');
  process.exit(1);
}

if (exists && !FORCE) {
  log('JWT_SECRET already set — leaving it unchanged (rotating would log out all users).');
  log('Use --force only if you intentionally want to rotate it.');
  process.exit(0);
}

if (exists && FORCE) {
  log('⚠ --force: rotating JWT_SECRET. This INVALIDATES all existing user tokens.');
}

const secret = genSecret();
// `wrangler secret put` reads the value from stdin when piped.
const res = spawnSync('npx', ['wrangler', 'secret', 'put', 'JWT_SECRET'], {
  input: secret + '\n',
  stdio: ['pipe', 'inherit', 'inherit'],
  env: { ...process.env, CI: '1' },
});
if (res.status !== 0) {
  log('Failed to set JWT_SECRET via wrangler.');
  process.exit(res.status ?? 1);
}
log('JWT_SECRET set successfully (value not shown).');
