import type { MessageBatch, D1Database, VectorizeIndex, Ai } from '@cloudflare/workers-types';
import { runAI } from '../utils/ai-mock';

interface PageSaveMessage {
  pageId: string;
  workspaceId: string;
  title: string;
  content?: string;
  createdAt?: number;
  updatedAt?: number;
}

interface Env {
  DB: D1Database;
  AI: Ai;
  VECTOR_INDEX: VectorizeIndex;
}

export async function handlePageSaveQueue(batch: MessageBatch<PageSaveMessage>, env: Env) {
  for (const message of batch.messages) {
    const { pageId, workspaceId, title, content } = message.body;

    const textToEmbed = content ? `${title}\n${content}` : title;
    const chunks = chunkText(textToEmbed, 512);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      // Use runAI for local-mode fallback
      const embedding = await runAI(env.AI, '@cf/baai/bge-base-en-v1.5', { text: chunk });
      const vec = (embedding as { data: number[][] }).data[0];

      try {
        await env.VECTOR_INDEX.upsert([
          {
            id: `${pageId}_chunk_${i}`,
            values: vec,
            metadata: {
              pageId,
              workspaceId,
              text: chunk,
              title,
            },
          },
        ]);
      } catch (err) {
        // Vectorize may not be available in local mode — skip silently
        console.log('[Queue] Vectorize unavailable in local mode, skipping embedding');
      }
    }
  }
}

function chunkText(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  let current = '';
  const sentences = text.split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    if ((current + sentence).length > maxLength) {
      if (current) chunks.push(current.trim());
      current = sentence;
    } else {
      current += ' ' + sentence;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}
