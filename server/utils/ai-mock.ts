/**
 * ai-mock.ts
 * Fallback AI implementation for local/offline development.
 * When Workers AI bindings are unavailable (local mode), these utilities
 * provide deterministic mocked responses so the app still functions.
 */

export interface MockEmbedding { data: number[][]; }

/**
 * Generates a deterministic pseudo-random float in [-1, 1]
 * using a simple LCG seeded by the input text.
 */
function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = (h * 1664525 + 1013904223) | 0;
    return (h >>> 0) / 4294967296 * 2 - 1;
  };
}

/**
 * Deterministic embedding generator. Produces a 768-dimension
 * float array that is consistent for the same input text.
 */
export function mockEmbedding(text: string): MockEmbedding {
  const rand = seededRandom(text);
  const vec: number[] = [];
  for (let i = 0; i < 768; i++) {
    vec.push(rand());
  }
  // L2-normalize
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  if (norm > 0) {
    for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  }
  return { data: [vec] };
}

/**
 * Deterministic LLM response generator.
 */
export function mockChat(messages: { role: string; content: string }[]): {
  response: string;
  tool_calls: any[];
} {
  const lastUser = messages.filter((m) => m.role === 'user').pop()?.content ?? '';
  const lower = lastUser.toLowerCase();

  // Simple keyword-based mocked responses
  if (lower.includes('create') || lower.includes('new page') || lower.includes('add page')) {
    return {
      response: `I'll create that page for you in your workspace.`,
      tool_calls: [{ name: 'create_new_botion_page', arguments: { title: lastUser.replace(/create|new|page/gi, '').trim() || 'Untitled' } }],
    };
  }
  if (lower.includes('search') || lower.includes('find')) {
    return {
      response: `I found some relevant documents in your workspace.`,
      tool_calls: [{ name: 'search_vectorize_workspace', arguments: { query: lastUser } }],
    };
  }

  return {
    response: `As the Botion AI Agent, I can help you create pages, search your workspace, and generate content. What would you like to do?`,
    tool_calls: [],
  };
}

/**
 * Wraps the real AI binding with a local fallback.
 */
export async function runAI(
  ai: any,
  model: string,
  input: any
): Promise<any> {
  if (ai) {
    try { return await ai.run(model, input); } catch { /* fall through */ }
  }
  // Local fallback
  if (model.includes('bge')) {
    return mockEmbedding(input.text ?? input);
  }
  if (model.includes('llama') || model.includes('mistral')) {
    return mockChat(input.messages ?? []);
  }
  return { response: 'AI service unavailable.', tool_calls: [] };
}
