import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { FileText, Search, X } from 'lucide-react';

interface PageHit { id: string; title: string; icon?: string; }

export function MentionsModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PageHit[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const setSelectedPageId = useUIStore((s) => s.setSelectedPageId);
  const pages = useUIStore((s) => s.pages);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const hits = pages
      .filter((p) => p.title.toLowerCase().includes(query.toLowerCase()))
      .map((p) => ({ id: p.id, title: p.title, icon: p.icon ?? undefined }))
      .slice(0, 10);
    setResults(hits);
  }, [query, pages]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 pt-[15vh] backdrop-blur-sm dark:bg-black/40">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-neutral-100 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2.5 dark:border-neutral-800">
          <Search className="h-4 w-4 text-neutral-400" />
          <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400 dark:text-neutral-100" />
          <button onClick={onClose} className="rounded p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-auto">
          {results.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-neutral-400">No pages found.</div>
          ) : (
            results.map((hit) => (
              <button key={hit.id}
                onClick={() => { setSelectedPageId(hit.id); onClose(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 transition hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800/50">
                {hit.icon ? <span className="text-base">{hit.icon}</span> : <FileText className="h-3.5 w-3.5 text-neutral-400" />}
                <span className="truncate">{hit.title}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
