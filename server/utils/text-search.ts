/**
 * text-search.ts
 * D1-only text search fallback for when Vectorize is unavailable
 * (local mode, or no production vector index provisioned).
 *
 * Pure serverless — no Node.js APIs. Uses SQL LIKE matching against
 * page titles and block content, scoped to a workspace.
 */

import type { DB } from '../db';

export interface TextSearchMatch {
  id: string;
  score: number;
  text: string;
  pageId: string;
  title: string;
}

interface PageRow {
  id: string;
  title: string;
}

interface BlockRow {
  page_id: string;
  title: string;
  content: string | null;
}

/**
 * Tokenize a free-text query into distinct lowercase terms.
 */
function tokenize(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .filter((t) => t.length > 1)
    )
  );
}

/**
 * Score a candidate by how many query terms appear in its text,
 * with a bonus for title matches. Returns a value in (0, 1].
 */
function scoreText(terms: string[], title: string, body: string): number {
  if (terms.length === 0) return 0;
  const t = title.toLowerCase();
  const b = body.toLowerCase();
  let hits = 0;
  let titleHits = 0;
  for (const term of terms) {
    if (t.includes(term)) {
      hits++;
      titleHits++;
    } else if (b.includes(term)) {
      hits++;
    }
  }
  if (hits === 0) return 0;
  // Base coverage ratio plus a title-weighted bonus, clamped to 1.
  const coverage = hits / terms.length;
  const titleBonus = (titleHits / terms.length) * 0.25;
  return Math.min(1, coverage * 0.75 + titleBonus);
}

/**
 * Search a workspace's pages/blocks by text, ranked by term coverage.
 * Returns up to `topK` matches shaped like Vectorize query results.
 */
export async function d1TextSearch(
  db: DB,
  workspaceId: string,
  query: string,
  topK = 5
): Promise<TextSearchMatch[]> {
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  const scored = new Map<string, TextSearchMatch>();

  // 1) Title matches from pages.
  const titleParams = [workspaceId, ...terms.map((t) => `%${t}%`)];
  const pageRows = await db.query<PageRow>(
    `SELECT id, title FROM pages
     WHERE workspace_id = ? AND is_folder = 0
       AND (${terms.map(() => 'LOWER(title) LIKE ?').join(' OR ')})
     LIMIT 50`,
    titleParams
  );
  for (const row of pageRows) {
    const score = scoreText(terms, row.title ?? '', '');
    if (score > 0) {
      scored.set(row.id, {
        id: `${row.id}_title`,
        score,
        text: row.title ?? '',
        pageId: row.id,
        title: row.title ?? '',
      });
    }
  }

  // 2) Block-content matches, joined to their page for workspace scoping.
  const blockParams: unknown[] = [workspaceId];
  const blockWhere = terms
    .map(() => 'LOWER(CAST(b.content AS TEXT)) LIKE ?')
    .join(' OR ');
  for (const t of terms) blockParams.push(`%${t}%`);
  const blockRows = await db.query<BlockRow>(
    `SELECT b.page_id AS page_id, p.title AS title, CAST(b.content AS TEXT) AS content
     FROM blocks b
     JOIN pages p ON p.id = b.page_id
     WHERE p.workspace_id = ? AND (${blockWhere})
     LIMIT 100`,
    blockParams
  );
  for (const row of blockRows) {
    const body = row.content ?? '';
    const score = scoreText(terms, row.title ?? '', body);
    if (score <= 0) continue;
    const existing = scored.get(row.page_id);
    // Keep the best-scoring snippet per page.
    if (!existing || score > existing.score) {
      scored.set(row.page_id, {
        id: `${row.page_id}_block`,
        score,
        text: snippet(body, terms),
        pageId: row.page_id,
        title: row.title ?? '',
      });
    }
  }

  return Array.from(scored.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Extract a short snippet of body text around the first matched term.
 */
function snippet(body: string, terms: string[], radius = 120): string {
  const lower = body.toLowerCase();
  let idx = -1;
  for (const term of terms) {
    const found = lower.indexOf(term);
    if (found !== -1 && (idx === -1 || found < idx)) idx = found;
  }
  if (idx === -1) return body.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(body.length, idx + radius);
  return (start > 0 ? '…' : '') + body.slice(start, end) + (end < body.length ? '…' : '');
}
