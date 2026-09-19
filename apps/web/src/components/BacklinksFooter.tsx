import { useEffect, useState } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { api } from '@/lib/api';
import { FileText, ArrowUpRight } from 'lucide-react';

interface Backlink {
  id: string;
  source_title: string;
  source_page_id: string;
  context?: string;
}

export function BacklinksFooter() {
  const selectedPageId = useUIStore((s) => s.selectedPageId);
  const setSelectedPageId = useUIStore((s) => s.setSelectedPageId);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);

  useEffect(() => {
    if (!selectedPageId) return;
    api.backlinks?.list?.(selectedPageId).then?.((res) => {
      setBacklinks(res.backlinks ?? []);
    }).catch(() => setBacklinks([]));
  }, [selectedPageId]);

  if (!selectedPageId || backlinks.length === 0) return null;

  return (
    <div className="mt-8 border-t border-neutral-100 pt-6 dark:border-neutral-800">
      <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        <ArrowUpRight className="h-3.5 w-3.5" />
        {backlinks.length} Backlink{backlinks.length > 1 ? 's' : ''}
      </h3>
      <div className="space-y-1">
        {backlinks.map((link) => (
          <button
            key={link.id}
            onClick={() => setSelectedPageId(link.source_page_id)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-neutral-600 transition hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-800/50"
          >
            <FileText className="h-3.5 w-3.5 text-neutral-400" />
            <span className="truncate">{link.source_title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
