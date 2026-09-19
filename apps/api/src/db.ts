import type { D1Database } from '@cloudflare/workers-types';

export function createDb(db: D1Database) {
  return {
    async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
      const { results } = await db.prepare(sql).bind(...(params ?? [])).all<T>();
      return results ?? [];
    },
    async queryOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null> {
      const result = await db.prepare(sql).bind(...(params ?? [])).first<T>();
      return result ?? null;
    },
    async exec(sql: string) {
      await db.exec(sql);
    },
    prepare(sql: string) {
      return db.prepare(sql);
    },
  };
}

export type DB = ReturnType<typeof createDb>;
