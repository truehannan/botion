#!/usr/bin/env node
/**
 * setup.js — One-time project bootstrap.
 *
 * Runs after `wrangler login`. Checks if required Cloudflare resources
 * exist and creates them if missing. Also guides the user to fill in
 * wrangler.toml IDs and set the JWT_SECRET.
 */
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

const RESOURCE_NAME = 'botion-db';
const BUCKET_NAME = 'botion-storage';
const QUEUE_NAME = 'page-save-queue';
const INDEX_NAME = 'botion-vectors';

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: opts.silent ? 'pipe' : 'inherit', ...opts });
  } catch (e) {
    if (opts.ignore) return '';
    throw e;
  }
}

function extractId(output, label) {
  const match = output.match(new RegExp(`${label}\\s*:\\s*([a-f0-9-]+)`, 'i'));
  return match?.[1] ?? null;
}

function updateWranglerToml(key, value) {
  let toml = readFileSync('wrangler.toml', 'utf-8');
  const re = new RegExp(`(${key}\\s*=\\s*")([^"]*)(")`, 'i');
  if (re.test(toml)) {
    toml = toml.replace(re, `$1${value}$3`);
  } else {
    toml += `\n${key} = "${value}"\n`;
  }
  writeFileSync('wrangler.toml', toml);
}

function main() {
  console.log('🔧 Botion Setup — Provisioning Cloudflare resources...\n');

  // ── D1 ───────────────────────────────────────────────
  console.log(`Checking D1 database: ${RESOURCE_NAME}...`);
  let d1Info = run(`npx wrangler d1 info ${RESOURCE_NAME}`, { silent: true, ignore: true });
  let d1Id = extractId(d1Info, 'database_id');

  if (!d1Id) {
    console.log(`  Creating D1 database: ${RESOURCE_NAME}...`);
    const createOut = run(`npx wrangler d1 create ${RESOURCE_NAME}`, { silent: true });
    d1Id = extractId(createOut, 'database_id');
    if (!d1Id) {
      console.error('  Failed to create D1 database. Check wrangler auth.');
      process.exit(1);
    }
    console.log(`  Created. ID: ${d1Id}`);
  } else {
    console.log(`  Exists. ID: ${d1Id}`);
  }

  updateWranglerToml('database_id', d1Id);

  // ── R2 ───────────────────────────────────────────────
  console.log(`\nChecking R2 bucket: ${BUCKET_NAME}...`);
  const r2Info = run(`npx wrangler r2 bucket info ${BUCKET_NAME}`, { silent: true, ignore: true });
  if (r2Info.includes('Not Found') || !r2Info) {
    console.log(`  Creating R2 bucket: ${BUCKET_NAME}...`);
    run(`npx wrangler r2 bucket create ${BUCKET_NAME}`);
  } else {
    console.log('  Exists.');
  }

  // ── Queue ────────────────────────────────────────────
  console.log(`\nChecking Queue: ${QUEUE_NAME}...`);
  const queueInfo = run(`npx wrangler queues info ${QUEUE_NAME}`, { silent: true, ignore: true });
  if (queueInfo.includes('Not Found') || !queueInfo) {
    console.log(`  Creating Queue: ${QUEUE_NAME}...`);
    run(`npx wrangler queues create ${QUEUE_NAME}`);
  } else {
    console.log('  Exists.');
  }

  // ── Vectorize ───────────────────────────────────────
  console.log(`\nChecking Vectorize index: ${INDEX_NAME}...`);
  const vecInfo = run(`npx wrangler vectorize info ${INDEX_NAME}`, { silent: true, ignore: true });
  if (vecInfo.includes('Not Found') || !vecInfo) {
    console.log(`  Creating Vectorize index: ${INDEX_NAME}...`);
    run(`npx wrangler vectorize create ${INDEX_NAME} --dimensions=768 --metric=cosine`);
  } else {
    console.log('  Exists.');
  }

  // ── JWT Secret ──────────────────────────────────────
  console.log('\nChecking JWT_SECRET...');
  const secretCheck = run('npx wrangler secret list', { silent: true, ignore: true });
  if (!secretCheck.includes('JWT_SECRET')) {
    console.log('  JWT_SECRET not found. Prompting to set...');
    run('npx wrangler secret put JWT_SECRET');
  } else {
    console.log('  Exists.');
  }

  console.log('\n✅ Setup complete. Run `pnpm db:migrate:local` to apply D1 migrations.');
}

main();
