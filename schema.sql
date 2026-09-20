-- Canonical schema for Botion (SQLite / Cloudflare D1)
-- Keep this file up to date; db-sync.js auto-generates migrations from it.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  parent_id TEXT REFERENCES pages(id),
  title TEXT NOT NULL DEFAULT 'Untitled',
  icon TEXT,
  cover_image TEXT,
  is_folder INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS page_permissions (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK(role IN ('owner','editor','viewer')),
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS document_states (
  page_id TEXT PRIMARY KEY REFERENCES pages(id),
  state BLOB NOT NULL,
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS blocks (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'paragraph',
  content JSON,
  props JSON,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS databases (
  id TEXT PRIMARY KEY,
  parent_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled Database',
  icon TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  database_id TEXT NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('text','number','select','multi_select','date','checkbox','url','email','person','relation','rollup','formula','ai_autofill')),
  config JSON,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS property_values (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  value JSON,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_propvals_unique ON property_values(property_id, page_id);

CREATE TABLE IF NOT EXISTS views (
  id TEXT PRIMARY KEY,
  database_id TEXT NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('table','board','gallery','list','calendar','timeline')),
  name TEXT NOT NULL DEFAULT 'Untitled View',
  config JSON,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS page_relations (
  id TEXT PRIMARY KEY,
  source_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  target_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  relation_property_id TEXT REFERENCES properties(id) ON DELETE SET NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS backlinks (
  id TEXT PRIMARY KEY,
  source_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  target_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  block_id TEXT REFERENCES blocks(id) ON DELETE SET NULL,
  context TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'system',
  ui_font TEXT NOT NULL DEFAULT 'inter',
  reading_font TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
