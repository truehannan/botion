import type { MessageBatch, D1Database, VectorizeIndex, Ai } from '@cloudflare/workers-types';

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
      const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: chunk });
      const vec = (embedding as { data: number[][] }).data[0];

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
