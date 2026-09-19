import { useEffect, useState } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { api } from '@/lib/api';
import { FileText } from 'lucide-react';

interface SuggestionItem {
  id: string;
  title: string;
  icon?: string;
}

export function MentionSuggestionMenu({
  query,
  onSelect,
}: {
  query: string;
  onSelect: (item: { id: string; title: string }) => void;
}) {
  const pages = useUIStore((s) => s.pages);
  const [items, setItems] = useState<SuggestionItem[]>([]);

  useEffect(() => {
    const hits = pages
      .filter((p) => p.title.toLowerCase().includes(query.toLowerCase()))
      .map((p) => ({ id: p.id, title: p.title, icon: p.icon ?? undefined }))
      .slice(0, 5);
    setItems(hits);
  }, [query, pages]);

  if (!items.length) return null;

  return (
    <div className="z-50 w-64 overflow-hidden rounded-lg border border-neutral-100 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
      {items.map((item, i) => (
        <button
          key={item.id}
          onClick={() => onSelect({ id: item.id, title: item.title })}
          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
            i === 0 ? 'bg-neutral-50 dark:bg-neutral-800' : ''
          } hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800`}
        >
          {item.icon ? <span>{item.icon}</span> : <FileText className="h-3.5 w-3.5 text-neutral-400" />}
          <span className="truncate">{item.title}</span>
        </button>
      ))}
    </div>
  );
}
