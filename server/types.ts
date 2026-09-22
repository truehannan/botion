import type {
  D1Database,
  R2Bucket,
  VectorizeIndex,
  Queue,
  DurableObjectNamespace,
  Ai,
} from '@cloudflare/workers-types';

import type { BotionSyncRoom } from './durable-objects/BotionSyncRoom';

/**
 * Hono environment types. All Cloudflare bindings are injected
 * via `env` at runtime — zero Node.js dependencies.
 */
export type AppEnv = {
  Bindings: {
    DB: D1Database;
    STORAGE: R2Bucket;
    // Optional: Vectorize is not auto-provisioned and may be absent. When it is,
    // semantic search falls back to the D1 text search (server/utils/text-search.ts).
    VECTOR_INDEX?: VectorizeIndex;
    PAGE_SAVE_QUEUE: Queue;
    BOTION_SYNC_ROOM: DurableObjectNamespace<BotionSyncRoom>;
    AI: Ai;
    JWT_SECRET: string;
    ENVIRONMENT: string;
  };
  Variables: {
    user: { id: string; email: string } | null;
  };
};

export type UserRow = {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
  avatar_url: string | null;
  created_at: number;
  updated_at: number;
};

export type WorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: number;
  updated_at: number;
};

export type PageRow = {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  title: string;
  icon: string | null;
  cover_image: string | null;
  is_folder: number;
  sort_order: number;
  created_at: number;
  updated_at: number;
};
