#!/usr/bin/env node
/**
 * build-client.js — build the frontend, ignoring any extra CLI args.
 *
 * Cloudflare Workers Builds appends its build id to the configured build
 * command (e.g. `pnpm build <uuid>`). pnpm forwards that trailing arg down to
 * `vite build <uuid>`, and Vite treats it as an entry module → the build fails
 * with `Could not resolve entry module "<uuid>/index.html"`.
 *
 * Running Vite through this wrapper (with a fixed, empty arg list) makes the
 * build immune to whatever trailing args are appended.
 */
import { spawnSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const clientDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'client');

const res = spawnSync('npx', ['vite', 'build'], {
  cwd: clientDir,
  stdio: 'inherit',
  env: { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=4096' },
});
process.exit(res.status ?? 1);
