#!/usr/bin/env node
/**
 * provision.js — Non-interactive, build-time resource resolver.
 *
 * Intended to run automatically before `wrangler deploy` (e.g. as the build
 * command in Cloudflare Workers Builds, or a predeploy step). It:
 *
 *   1. Resolves the D1 `database_id` by NAME via `wrangler d1 list --json`.
 *      Creates the database if it does not exist. Writes the id into
 *      wrangler.toml, replacing the placeholder.
 *   2. Ensures a `[[vectorize]]` binding exists in wrangler.toml and that the
 *      named index exists (creates it with the project's dims/metric if not).
 *      Vectorize binds by index_name (not an opaque id), so no id injection
 *      is needed — only presence of the binding + the index.
 *
 * No API key is required when this runs inside Cloudflare Workers Builds:
 * that environment is already authenticated. In a generic CI you must provide
 * CLOUDFLARE_API_TOKEN (+ CLOUDFLARE_ACCOUNT_ID) as usual for wrangler.
 *
 * Safe to run locally: if wrangler is not authenticated (no account access),
 * the script logs a warning and exits 0 so `pnpm build` never hard-fails.
 * Use --strict to make auth/create failures fatal (recommended in CI deploy).
 */
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';

// ── Config: resource names must match wrangler.toml ──────────────
const D1_NAME = 'botion-db';
const D1_BINDING = 'DB';
const VECTORIZE_INDEX = 'botion-vectors';
const VECTORIZE_BINDING = 'VECTOR_INDEX';
const VECTORIZE_DIMENSIONS = 768;
const VECTORIZE_METRIC = 'cosine';
const TOML_PATH = 'wrangler.toml';

const STRICT = process.argv.includes('--strict');

function log(msg) { console.log(`[provision] ${msg}`); }
function warn(msg) { console.warn(`[provision] ⚠ ${msg}`); }

/** Run a command, capturing stdout. Returns null on failure. */
function runCapture(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return null;
  }
}

/** Run a command for side effects. Returns true on success. */
function runOk(cmd) {
  try {
    execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
    return true;
  } catch (e) {
    return false;
  }
}

function fail(msg) {
  if (STRICT) {
    console.error(`[provision] ✗ ${msg}`);
    process.exit(1);
  }
  warn(`${msg} (non-strict: continuing)`);
}

/** Parse `wrangler <resource> list --json`, tolerant of banner noise. */
function listJson(cmd) {
  const out = runCapture(cmd);
  if (out == null) return null; // command failed (auth, network, etc.)
  // Some wrangler versions print a banner before the JSON; slice from first bracket.
  const start = out.search(/[\[{]/);
  if (start === -1) return null;
  try {
    return JSON.parse(out.slice(start));
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// D1: resolve database_id by name, create if missing, inject into toml
// ─────────────────────────────────────────────────────────────────
function provisionD1(toml) {
  log(`Resolving D1 database "${D1_NAME}"...`);
  let list = listJson(`npx wrangler d1 list --json`);

  if (list == null) {
    fail(`Could not list D1 databases — wrangler not authenticated?`);
    return toml;
  }

  let db = Array.isArray(list) ? list.find((d) => d.name === D1_NAME) : null;

  if (!db) {
    log(`Not found. Creating D1 database "${D1_NAME}"...`);
    if (!runOk(`npx wrangler d1 create ${D1_NAME}`)) {
      fail(`Failed to create D1 database "${D1_NAME}"`);
      return toml;
    }
    list = listJson(`npx wrangler d1 list --json`);
    db = Array.isArray(list) ? list.find((d) => d.name === D1_NAME) : null;
  }

  const id = db?.uuid ?? db?.id ?? db?.database_id;
  if (!id) {
    fail(`Resolved D1 "${D1_NAME}" but could not read its id from list output`);
    return toml;
  }

  log(`D1 "${D1_NAME}" → ${id}`);
  return setD1DatabaseId(toml, id);
}

/**
 * Replace the database_id inside the [[d1_databases]] block whose
 * database_name matches D1_NAME. Falls back to replacing the first
 * database_id if the block can't be pinpointed.
 */
function setD1DatabaseId(toml, id) {
  const blockRe = /(\[\[d1_databases\]\][\s\S]*?)(?=\n\[\[|\n\[|$)/g;
  let replaced = false;
  const updated = toml.replace(blockRe, (block) => {
    if (!new RegExp(`database_name\\s*=\\s*"${escapeRe(D1_NAME)}"`).test(block)) {
      return block;
    }
    replaced = true;
    if (/database_id\s*=\s*"[^"]*"/.test(block)) {
      return block.replace(/(database_id\s*=\s*")[^"]*(")/, `$1${id}$2`);
    }
    // No database_id line present — add one after database_name.
    return block.replace(
      /(database_name\s*=\s*"[^"]*"\s*\n)/,
      `$1database_id = "${id}"\n`
    );
  });
  if (!replaced) {
    fail(`Could not find a [[d1_databases]] block with database_name = "${D1_NAME}"`);
    return toml;
  }
  return updated;
}

// ─────────────────────────────────────────────────────────────────
// Vectorize: ensure index exists + binding present in toml
// ─────────────────────────────────────────────────────────────────
function provisionVectorize(toml) {
  log(`Resolving Vectorize index "${VECTORIZE_INDEX}"...`);
  const list = listJson(`npx wrangler vectorize list --json`);

  if (list == null) {
    fail(`Could not list Vectorize indexes — wrangler not authenticated?`);
  } else {
    const found = Array.isArray(list) && list.some((i) => i.name === VECTORIZE_INDEX);
    if (!found) {
      log(`Not found. Creating Vectorize index "${VECTORIZE_INDEX}"...`);
      const ok = runOk(
        `npx wrangler vectorize create ${VECTORIZE_INDEX} --dimensions=${VECTORIZE_DIMENSIONS} --metric=${VECTORIZE_METRIC}`
      );
      if (!ok) fail(`Failed to create Vectorize index "${VECTORIZE_INDEX}"`);
      else log(`Created Vectorize index "${VECTORIZE_INDEX}"`);
    } else {
      log(`Vectorize index "${VECTORIZE_INDEX}" exists`);
    }
  }

  // Ensure the binding is present in wrangler.toml (bind by name, no id).
  if (new RegExp(`index_name\\s*=\\s*"${escapeRe(VECTORIZE_INDEX)}"`).test(toml)) {
    return toml;
  }
  log(`Adding [[vectorize]] binding "${VECTORIZE_BINDING}" → "${VECTORIZE_INDEX}" to ${TOML_PATH}`);
  const block = `\n# ━━ Vectorize (semantic search) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n[[vectorize]]\nbinding = "${VECTORIZE_BINDING}"\nindex_name = "${VECTORIZE_INDEX}"\n`;
  return toml.trimEnd() + '\n' + block;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─────────────────────────────────────────────────────────────────
function main() {
  if (!existsSync(TOML_PATH)) {
    console.error(`[provision] ✗ ${TOML_PATH} not found (run from project root)`);
    process.exit(STRICT ? 1 : 0);
  }

  log(`Starting${STRICT ? ' (strict)' : ''}...`);
  let toml = readFileSync(TOML_PATH, 'utf-8');
  const before = toml;

  toml = provisionD1(toml);
  toml = provisionVectorize(toml);

  if (toml !== before) {
    writeFileSync(TOML_PATH, toml);
    log(`Wrote updates to ${TOML_PATH}`);
  } else {
    log(`No changes needed to ${TOML_PATH}`);
  }

  log('Done.');
}

main();
