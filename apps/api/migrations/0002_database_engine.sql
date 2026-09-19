-- Expanded page metadata
ALTER TABLE pages ADD COLUMN cover_image TEXT;
ALTER TABLE pages ADD COLUMN icon TEXT;

-- Blocks: normalized content for database rows
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
CREATE INDEX IF NOT EXISTS idx_blocks_page ON blocks(page_id);

-- Databases (a page can also be a database/root for views)
CREATE TABLE IF NOT EXISTS databases (
  id TEXT PRIMARY KEY,
  parent_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled Database',
  icon TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_databases_parent ON databases(parent_page_id);

-- Properties (columns in a database view)
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
CREATE INDEX IF NOT EXISTS idx_properties_db ON properties(database_id);

-- Property values (cell-level data)
CREATE TABLE IF NOT EXISTS property_values (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  value JSON,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_propvals_prop ON property_values(property_id);
CREATE INDEX IF NOT EXISTS idx_propvals_page ON property_values(page_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_propvals_unique ON property_values(property_id, page_id);

-- Views (table, board, gallery, list, calendar, timeline)
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
CREATE INDEX IF NOT EXISTS idx_views_db ON views(database_id);

-- Page Relations (two-way linking)
CREATE TABLE IF NOT EXISTS page_relations (
  id TEXT PRIMARY KEY,
  source_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  target_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  relation_property_id TEXT REFERENCES properties(id) ON DELETE SET NULL,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_rel_src ON page_relations(source_page_id);
CREATE INDEX IF NOT EXISTS idx_rel_tgt ON page_relations(target_page_id);

-- Backlinks (inverted index for @mentions)
CREATE TABLE IF NOT EXISTS backlinks (
  id TEXT PRIMARY KEY,
  source_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  target_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  block_id TEXT REFERENCES blocks(id) ON DELETE SET NULL,
  context TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_bk_src ON backlinks(source_page_id);
CREATE INDEX IF NOT EXISTS idx_bk_tgt ON backlinks(target_page_id);

-- User Settings (theme, font preferences)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'system',
  ui_font TEXT NOT NULL DEFAULT 'inter',
  reading_font TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
