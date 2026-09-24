// localApi.ts — a fully local, no-server implementation of the `api` surface.
// Used in native "local mode": all data lives in this device's localStorage,
// no account, no network. Mirrors the server's response shapes so the rest of
// the app is agnostic to which backend it's talking to.

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const now = () => Math.floor(Date.now() / 1000);

type Row = Record<string, any>;

const KEY = 'botion_local_db';

interface LocalDB {
  workspaces: Row[];
  pages: Row[];
  databases: Row[];
  properties: Row[];
  views: Row[];
  property_values: Row[];
  backlinks: Row[];
  document_states: Record<string, any>;
  settings: Row | null;
}

function load(): LocalDB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore corrupt state */ }
  return {
    workspaces: [], pages: [], databases: [], properties: [], views: [],
    property_values: [], backlinks: [], document_states: {}, settings: null,
  };
}

function save(db: LocalDB) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

/** Ensure there is at least one workspace with a home page (first run). */
function ensureSeed(db: LocalDB) {
  if (db.workspaces.length === 0) {
    const wsId = uid();
    const t = now();
    db.workspaces.push({ id: wsId, name: 'My Workspace', slug: 'my-workspace', owner_id: 'local', created_at: t, updated_at: t });
    db.pages.push({ id: uid(), workspace_id: wsId, parent_id: null, title: 'Welcome', icon: '👋', is_folder: 0, sort_order: 0, created_at: t, updated_at: t });
    save(db);
  }
}

export const localApi = {
  auth: {
    // Local mode has no real auth; return a synthetic local user.
    login: async () => ({ token: 'local', user: { id: 'local', email: 'local@device', name: 'Local' } }),
    register: async () => ({ token: 'local', user: { id: 'local', email: 'local@device', name: 'Local' } }),
    me: async () => ({ user: { id: 'local', email: 'local@device', name: 'Local' } }),
  },
  workspaces: {
    list: async () => { const db = load(); ensureSeed(db); return { workspaces: db.workspaces }; },
    get: async (id: string) => { const db = load(); return { workspace: db.workspaces.find((w) => w.id === id) ?? null }; },
    create: async (data: { name: string; slug: string }) => {
      const db = load(); const t = now();
      const ws = { id: uid(), name: data.name, slug: data.slug, owner_id: 'local', created_at: t, updated_at: t };
      db.workspaces.push(ws); save(db); return { workspace: ws };
    },
  },
  pages: {
    list: async (workspaceId: string, parentId?: string | null) => {
      const db = load(); ensureSeed(db);
      let pages = db.pages.filter((p) => p.workspace_id === workspaceId);
      if (parentId !== undefined) {
        const pid = parentId === null || parentId === 'null' ? null : parentId;
        pages = pages.filter((p) => (p.parent_id ?? null) === pid);
      } else {
        pages = pages.filter((p) => (p.parent_id ?? null) === null);
      }
      pages.sort((a, b) => a.sort_order - b.sort_order || a.created_at - b.created_at);
      return { pages };
    },
    get: async (id: string) => { const db = load(); return { page: db.pages.find((p) => p.id === id) ?? null }; },
    create: async (data: { workspace_id: string; parent_id?: string | null; title?: string; is_folder?: boolean }) => {
      const db = load(); const t = now();
      const page = {
        id: uid(), workspace_id: data.workspace_id, parent_id: data.parent_id ?? null,
        title: data.title ?? 'Untitled', icon: null, cover_image: null,
        is_folder: data.is_folder ? 1 : 0, sort_order: 0, created_at: t, updated_at: t,
      };
      db.pages.push(page); save(db); return { page };
    },
    update: async (id: string, data: Row) => {
      const db = load(); const p = db.pages.find((x) => x.id === id);
      if (p) { Object.assign(p, data, { updated_at: now() }); save(db); }
      return { page: p ?? null };
    },
    delete: async (id: string) => {
      const db = load();
      db.pages = db.pages.filter((p) => p.id !== id);
      db.property_values = db.property_values.filter((v) => v.page_id !== id);
      db.databases = db.databases.filter((d) => d.parent_page_id !== id);
      db.backlinks = db.backlinks.filter((b) => b.source_page_id !== id && b.target_page_id !== id);
      delete db.document_states[id];
      db.pages.forEach((p) => { if (p.parent_id === id) p.parent_id = null; });
      save(db); return { success: true };
    },
  },
  sync: {
    post: async (pageId: string, body: { blocks: any[]; title?: string }) => {
      const db = load();
      db.document_states[pageId] = { blocks: body.blocks, updated_at: now() };
      if (body.title !== undefined) { const p = db.pages.find((x) => x.id === pageId); if (p) p.title = body.title; }
      save(db); return { success: true, updated_at: now() };
    },
    get: async (pageId: string) => {
      const db = load(); const state = db.document_states[pageId] ?? null;
      return { state, updated_at: state?.updated_at };
    },
  },
  mcp: {
    // No AI locally; return a helpful, deterministic message.
    chat: async () => ({ message: 'AI chat requires connecting to a Botion server. You are in local mode.', tool_calls: [], tool_results: [] }),
  },
  backlinks: {
    list: async (targetPageId: string) => {
      const db = load();
      const backlinks = db.backlinks
        .filter((b) => b.target_page_id === targetPageId)
        .map((b) => ({ ...b, source_title: db.pages.find((p) => p.id === b.source_page_id)?.title ?? 'Untitled' }));
      return { backlinks };
    },
    create: async (data: Row) => {
      const db = load(); const id = uid();
      db.backlinks.push({ id, ...data, created_at: now() }); save(db); return { backlink: { id } };
    },
  },
  databases: {
    list: async (parentPageId: string) => {
      const db = load();
      const databases = db.databases.filter((d) => d.parent_page_id === parentPageId).map((d) => ({
        ...d,
        properties: db.properties.filter((p) => p.database_id === d.id).sort((a, b) => a.sort_order - b.sort_order),
        views: db.views.filter((v) => v.database_id === d.id).sort((a, b) => a.sort_order - b.sort_order),
      }));
      return { databases };
    },
    create: async (data: { parent_page_id: string; name?: string }) => {
      const db = load(); const t = now(); const id = uid();
      const database = { id, parent_page_id: data.parent_page_id, name: data.name ?? 'Untitled Database', created_at: t, updated_at: t };
      db.databases.push(database);
      const defs: Array<[string, string]> = [['Name', 'text'], ['Status', 'select'], ['Tags', 'multi_select'], ['Due Date', 'date']];
      defs.forEach(([name, type], i) => db.properties.push({ id: uid(), database_id: id, name, type, config: {}, sort_order: i, created_at: t, updated_at: t }));
      db.views.push({ id: uid(), database_id: id, type: 'table', name: 'Table', config: {}, sort_order: 0, created_at: t, updated_at: t });
      save(db); return { database };
    },
    delete: async (id: string) => {
      const db = load();
      db.databases = db.databases.filter((d) => d.id !== id);
      db.properties = db.properties.filter((p) => p.database_id !== id);
      db.views = db.views.filter((v) => v.database_id !== id);
      save(db); return { success: true };
    },
  },
  properties: {
    create: async (data: Row) => {
      const db = load(); const t = now(); const id = uid();
      const property = { id, database_id: data.database_id, name: data.name, type: data.type, config: data.config ?? {}, sort_order: 0, created_at: t, updated_at: t };
      db.properties.push(property); save(db); return { property };
    },
    update: async (id: string, data: Row) => {
      const db = load(); const p = db.properties.find((x) => x.id === id);
      if (p) { Object.assign(p, data, { updated_at: now() }); save(db); }
      return { property: p ?? null };
    },
    delete: async (id: string) => {
      const db = load(); db.properties = db.properties.filter((p) => p.id !== id); save(db); return { success: true };
    },
  },
  propertyValues: {
    list: async (pageIds: string[]) => {
      const db = load();
      const values = db.property_values.filter((v) => pageIds.includes(v.page_id)).map((v) => {
        const prop = db.properties.find((p) => p.id === v.property_id);
        return { ...v, property_name: prop?.name, property_type: prop?.type, property_config: prop?.config };
      });
      return { values };
    },
    upsert: async (data: { property_id: string; page_id: string; value: any }) => {
      const db = load();
      let row = db.property_values.find((v) => v.property_id === data.property_id && v.page_id === data.page_id);
      if (row) { row.value = data.value; row.updated_at = now(); }
      else { row = { id: uid(), property_id: data.property_id, page_id: data.page_id, value: data.value, created_at: now(), updated_at: now() }; db.property_values.push(row); }
      save(db); return { value: row.id };
    },
  },
  views: {
    create: async (data: Row) => {
      const db = load(); const t = now(); const id = uid();
      const view = { id, database_id: data.database_id, type: data.type, name: data.name, config: data.config ?? {}, sort_order: 0, created_at: t, updated_at: t };
      db.views.push(view); save(db); return { view };
    },
    update: async (id: string, data: Row) => {
      const db = load(); const v = db.views.find((x) => x.id === id);
      if (v) { Object.assign(v, data, { updated_at: now() }); save(db); }
      return { view: v ?? null };
    },
    delete: async (id: string) => {
      const db = load(); db.views = db.views.filter((v) => v.id !== id); save(db); return { success: true };
    },
  },
  settings: {
    get: async () => { const db = load(); return { settings: db.settings ?? { theme: 'system', ui_font: 'inter', reading_font: null } }; },
    update: async (data: Row) => {
      const db = load();
      db.settings = { theme: data.theme ?? 'system', ui_font: data.ui_font ?? 'inter', reading_font: data.reading_font ?? null, updated_at: now() };
      save(db); return { success: true };
    },
  },
};
