import { useEffect, useState } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { api } from '@/lib/api';
import { ImagePlus, Smile } from 'lucide-react';

export function PageHeader() {
  const selectedPageId = useUIStore((s) => s.selectedPageId);
  const [title, setTitle] = useState('Untitled');
  const [icon, setIcon] = useState<string>('');
  const [cover, setCover] = useState<string>('');
  const [editingTitle, setEditingTitle] = useState(false);

  useEffect(() => {
    if (!selectedPageId) return;
    api.pages.get(selectedPageId).then((res) => {
      if (res.page) {
        setTitle(res.page.title);
        setIcon(res.page.icon ?? '');
        setCover(res.page.cover_image ?? '');
      }
    });
  }, [selectedPageId]);

  const save = async (updates: Partial<{ title: string; icon: string; cover_image: string }>) => {
    if (!selectedPageId) return;
    await api.pages.update(selectedPageId, updates);
  };

  if (!selectedPageId) return null;

  return (
    <div className="mx-auto w-full max-w-3xl px-12 pt-8">
      {cover && (
        <div className="relative mb-4 h-48 w-full overflow-hidden rounded-lg">
          <img src={cover} alt="Cover" className="h-full w-full object-cover" />
          <button
            onClick={() => { setCover(''); save({ cover_image: '' }); }}
            className="absolute right-2 top-2 rounded bg-black/50 px-2 py-1 text-[10px] text-white opacity-0 transition hover:bg-black/70 group-hover:opacity-100"
          >
            Remove
          </button>
        </div>
      )}

      <div className="mb-6 flex items-end gap-4">
        <button
          onClick={() => {
            const emoji = prompt('Enter page icon (emoji):') ?? '';
            setIcon(emoji);
            save({ icon: emoji });
          }}
          className="flex h-16 w-16 items-center justify-center rounded-lg bg-neutral-50 text-2xl transition hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700"
        >
          {icon || <Smile className="h-5 w-5 text-neutral-400" />}
        </button>

        <div className="flex-1">
          {editingTitle ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => { setEditingTitle(false); save({ title }); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setEditingTitle(false);
                  save({ title });
                }
              }}
              className="w-full bg-transparent text-3xl font-bold tracking-tight text-neutral-900 outline-none placeholder:text-neutral-300 dark:text-neutral-100"
            />
          ) : (
            <h1
              onClick={() => setEditingTitle(true)}
              className="cursor-text text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100"
            >
              {title || 'Untitled'}
            </h1>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!cover && (
          <button
            onClick={() => {
              const url = prompt('Enter cover image URL:') ?? '';
              setCover(url);
              save({ cover_image: url });
            }}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-neutral-500 transition hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            Add cover
          </button>
        )}
      </div>
    </div>
  );
}
