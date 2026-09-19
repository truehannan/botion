#!/usr/bin/env node
/**
 * db-sync.js
 * Parses the canonical schema.sql and wrangler.toml to generate
 * D1 migration files and provision the database if missing.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const MIGRATIONS_DIR = join(ROOT, 'migrations');
const SCHEMA_FILE = join(ROOT, 'migrations', 'schema.sql');
const TOML = readFileSync(join(ROOT, 'wrangler.toml'), 'utf-8');
const DB_NAME = TOML.match(/database_name\s*=\s*"([^"]+)"/)?.[1];

if (!DB_NAME) {
  console.error('No database_name found in wrangler.toml');
  process.exit(1);
}

function getNextMigrationNum() {
  const files = existsSync(MIGRATIONS_DIR)
    ? readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('.sql'))
        .sort()
    : [];
  const max = files.length
    ? Math.max(...files.map((f) => parseInt(f.split('_')[0], 10) || 0))
    : 0;
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
    const colRe = /^\s*(\w+)\s+(\w+)/gm;
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
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
    const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(([^;]+?)\);/gis;
    let m;
    while ((m = re.exec(sql))) {
      const name = m[1];
      const body = m[2];
      const columns = new Set();
      const colRe = /^\s*(?:ADD\s+COLUMN\s+)?(\w+)\s+(\w+)/gm;
      let cm;
      while ((cm = colRe.exec(body))) columns.add(cm[1]);
      if (!tables.has(name)) tables.set(name, new Set());
      for (const c of columns) tables.get(name).add(c);
    }
    // Also check ALTER TABLE ADD COLUMN
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
    console.error(`No ${SCHEMA_FILE} found. Please create the canonical schema file.`);
    process.exit(1);
  }

  // Provision D1 if needed
  try {
    execSync(`npx wrangler d1 info ${DB_NAME}`, { stdio: 'pipe' });
  } catch {
    console.log(`Creating D1 database ${DB_NAME}...`);
    try {
      execSync(`npx wrangler d1 create ${DB_NAME}`, { stdio: 'inherit' });
    } catch {
      console.log('D1 create may have failed or database already exists.');
    }
  }

  const schemaSql = readFileSync(SCHEMA_FILE, 'utf-8');
  const desiredTables = extractTables(schemaSql);
  const existingTables = extractExistingMigrations();

  const missingStatements = [];

  for (const [table, columns] of desiredTables) {
    if (!existingTables.has(table)) {
      // Entire table is missing — collect from canonical schema
      const tableMatch = schemaSql.match(
        new RegExp(
          `CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${table}\\s*\\(([^;]+?)\\);`,
          'is'
        )
      );
      if (tableMatch) {
        missingStatements.push(
          `CREATE TABLE IF NOT EXISTS ${table} (${tableMatch[1].trim()});`
        );
      }
    } else {
      // Check for missing columns
      const existingCols = existingTables.get(table);
      for (const col of columns) {
        if (!existingCols.has(col)) {
          // Extract line from schema containing this column
          const tableMatch = schemaSql.match(
            new RegExp(
              `CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${table}\\s*\\(([^;]+?)\\);`,
              'is'
            )
          );
          if (tableMatch) {
            const colLine = tableMatch[1]
              .split('\n')
              .find((line) => line.trim().startsWith(col));
            if (colLine) {
              missingStatements.push(
                `ALTER TABLE ${table} ADD COLUMN ${colLine.trim().replace(/,$/, '')};`
              );
            }
          }
        }
      }
    }
  }

  if (missingStatements.length === 0) {
    console.log('Schema is up to date. No migrations needed.');

    // Apply existing migrations anyway
    execSync(`npx wrangler d1 migrations apply ${DB_NAME} --local`, {
      stdio: 'inherit',
    });
    process.exit(0);
  }

  const nextNum = getNextMigrationNum();
  const migrationFile = join(MIGRATIONS_DIR, `${nextNum}_auto_generated.sql`);

  writeFileSync(
    migrationFile,
    `-- Auto-generated migration by db-sync.js\n-- Generated: ${new Date().toISOString()}\n\n` +
      missingStatements.join('\n\n') +
      '\n'
  );

  console.log(`Created ${migrationFile}`);
  console.log('Applying migration...');
  execSync(`npx wrangler d1 migrations apply ${DB_NAME} --local`, {
    stdio: 'inherit',
  });
}

main();
