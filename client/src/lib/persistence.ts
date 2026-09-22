/**
 * persistence.ts
 * Client-side offline persistence via IndexedDB.
 * Stores page content snapshots, auto-saves with debounce,
 * and queues sync operations for when the network returns.
 */

const DB_NAME = 'botion_cache';
const DB_VERSION = 1;

type PageSnapshot = {
  id: string;
  title: string;
  content: any[];
  updatedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('pages')) {
        db.createObjectStore('pages', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pending_sync')) {
        db.createObjectStore('pending_sync', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

/**
 * Save a page snapshot to IndexedDB.
 */
export async function saveSnapshot(pageId: string, title: string, content: any[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('pages', 'readwrite');
  const store = tx.objectStore('pages');
  await new Promise<void>((resolve, reject) => {
    const req = store.put({ id: pageId, title, content, updatedAt: Date.now() });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  db.close();
}

/**
 * Load the most recent snapshot for a page.
 */
export async function loadSnapshot(pageId: string): Promise<PageSnapshot | null> {
  const db = await openDb();
  const tx = db.transaction('pages', 'readonly');
  const store = tx.objectStore('pages');
  const result = await new Promise<PageSnapshot | undefined>((resolve, reject) => {
    const req = store.get(pageId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result ?? null;
}

/**
 * Queue a sync operation (REST-based page save).
 */
export async function queueSync(pageId: string, content: any[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('pending_sync', 'readwrite');
  const store = tx.objectStore('pending_sync');
  await new Promise<void>((resolve, reject) => {
    const req = store.put({ pageId, content, queuedAt: Date.now() });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  db.close();
}

/**
 * Drain the pending sync queue.
 */
export async function drainSyncQueue(syncFn: (pageId: string, content: any[]) => Promise<void>): Promise<number> {
  const db = await openDb();
  const tx = db.transaction('pending_sync', 'readwrite');
  const store = tx.objectStore('pending_sync');

  const pending = await new Promise<any[]>((resolve, reject) => {
    const req = store.openCursor();
    const items: any[] = [];
    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest).result;
      if (cursor) { items.push(cursor.value); cursor.continue(); }
      else resolve(items);
    };
    req.onerror = () => reject(req.error);
  });

  let synced = 0;
  for (const item of pending) {
    try {
      await syncFn(item.pageId, item.content);
      await new Promise<void>((resolve, reject) => {
        const req = store.delete(item.id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      synced++;
    } catch {
      // Leave in queue for retry
    }
  }
  db.close();
  return synced;
}

/**
 * Debounce helper. Calls fn after ms of inactivity.
 */
export function debounce<T extends (...args: any[]) => void>(fn: T, ms = 2000): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: any[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { fn(...args); timer = null; }, ms);
  }) as T;
}

/**
 * Whether to use local/REST sync instead of a WebSocket.
 * The Durable Object that backed WebSocket sync has been removed, so this is
 * always true — editing persists via the REST endpoint POST /sync/:pageId
 * (debounced auto-save + IndexedDB offline queue).
 */
export function prefersLocalSync(): boolean {
  return true;
}
