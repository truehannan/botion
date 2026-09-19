import { useState, useRef, useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { api } from '@/lib/api';
import { Send, X, Loader2, Sparkles } from 'lucide-react';

export function InlineAIWidget() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const setInlineAIOpen = useUIStore((s) => s.setInlineAIOpen);
  const activeWorkspaceId = useUIStore((s) => s.activeWorkspaceId);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !activeWorkspaceId) return;

    setLoading(true);
    setResponse('');

    try {
      const res = await api.mcp.chat(
        [{ role: 'user', content: prompt }],
        activeWorkspaceId
      );
      setResponse(res.message?.content || JSON.stringify(res.message));
    } catch (err: any) {
      setResponse(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-neutral-900">
          <Sparkles className="h-4 w-4 text-neutral-500" />
          Botion Agent
        </div>
        <button
          onClick={() => setInlineAIOpen(false)}
          className="rounded p-1 text-neutral-400 hover:bg-neutral-50 hover:text-neutral-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask the agent anything..."
          className="flex-1 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-neutral-400 focus:bg-white"
        />
        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          className="rounded-md bg-neutral-900 p-2 text-white transition hover:bg-neutral-800 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>

      {response && (
        <div className="mt-3 rounded-md bg-neutral-50 p-3 text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap">
          {response}
        </div>
      )}
    </div>
  );
}
