#!/usr/bin/env node
/**
 * db-sync.js
 * Parses the canonical migrations/schema.sql and generates D1 migration files
 * by diffing against already-applied migrations. Then runs `wrangler d1 migrations apply`.
 *
 * Run: node scripts/db-sync.js
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MIGRATIONS_DIR = join(ROOT, 'migrations');
const SCHEMA_FILE = join(ROOT, 'migrations', 'schema.sql');
const DB_NAME = 'botion-db';

function getNextMigrationNum() {
  const files = existsSync(MIGRATIONS_DIR)
    ? readdirSync(MIGRATIONS_DIR).filter((f) => /\d{4}_.*\.sql$/.test(f)).sort()
    : [];
  const max = files.length ? Math.max(...files.map((f) => parseInt(f.match(/^(\d{4})/)?.[1] ?? '0', 10))) : 0;
  return String(max + 1).padStart(4, '0');
}

function extractTables(sql) {
  const tables = new Map();
  const re = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)\s*\(([^;]+?)\);/gis;
  let m;
  while ((m = re.exec(sql))) {
    const name = m[1];
    const body = m[2];
    const columns = [];
    const colRe = /^\s*(\w+)\s+\w+/gm;
    let cm;
    while ((cm = colRe.exec(body))) columns.push(cm[1]);
    tables.set(name, columns);
  }
  return tables;
}

function extractExistingMigrations() {
  if (!existsSync(MIGRATIONS_DIR)) return new Map();
  const tables = new Map();
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /\d{4}_.*\.sql$/.test(f))
    .sort();
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');

    // CREATE TABLE
    const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(([^;]+?)\);/gis;
    let m;
    while ((m = re.exec(sql))) {
      const name = m[1];
      const body = m[2];
      const columns = new Set();
      const colRe = /^\s*(?:"?\w+"?\s+)?(\w+)\s+\w+/gm;
      let cm;
      while ((cm = colRe.exec(body))) columns.add(cm[1]);
      if (!tables.has(name)) tables.set(name, new Set());
      for (const c of columns) tables.get(name).add(c);
    }

    // ALTER TABLE ADD COLUMN
    const alterRe = /ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)/gi;
    let am;
    while ((am = alterRe.exec(sql))) {
      const table = am[1];
      const col = am[2];
      if (!tables.has(table)) tables.set(table, new Set());
      tables.get(table).add(col);
    }
  }
  return tables;
}

function main() {
  if (!existsSync(SCHEMA_FILE)) {
    console.error(`No ${SCHEMA_FILE} found.`);
    process.exit(1);
  }

  const schemaSql = readFileSync(SCHEMA_FILE, 'utf-8');
  const desiredTables = extractTables(schemaSql);
  const existingTables = extractExistingMigrations();

  const missingStatements = [];

  for (const [table, columns] of desiredTables) {
    if (!existingTables.has(table)) {
      const tableMatch = schemaSql.match(
        new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${table}\\s*\\(([^;]+?)\\);`, 'is')
      );
      if (tableMatch) {
        missingStatements.push(`CREATE TABLE IF NOT EXISTS ${table} (${tableMatch[1].trim()});`);
      }
    } else {
      const existingCols = existingTables.get(table);
      for (const col of columns) {
        if (!existingCols.has(col)) {
          const tableMatch = schemaSql.match(
            new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${table}\\s*\\(([^;]+?)\\);`, 'is')
          );
          if (tableMatch) {
            const colLine = tableMatch[1].split('\n').find((line) => line.trim().startsWith(col));
            if (colLine) {
              missingStatements.push(`ALTER TABLE ${table} ADD COLUMN ${colLine.trim().replace(/,\s*$/, '')};`);
            }
          }
        }
      }
    }
  }

  if (missingStatements.length === 0) {
    console.log('Schema is up to date. No migrations needed.');
  } else {
    const nextNum = getNextMigrationNum();
    const migrationFile = join(MIGRATIONS_DIR, `${nextNum}_auto_generated.sql`);
    writeFileSync(
      migrationFile,
      `-- Auto-generated migration\n-- Generated: ${new Date().toISOString()}\n\n${missingStatements.join('\n\n')}\n`
    );
    console.log(`Created ${migrationFile}`);
  }

  console.log('Applying migrations...');
  execSync(`npx wrangler d1 migrations apply ${DB_NAME} --local`, { stdio: 'inherit' });
  console.log('Done.');
}

main();
