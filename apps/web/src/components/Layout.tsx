import { Sidebar } from './Sidebar';
import { Editor } from './Editor';
import { useUIStore } from '@/stores/uiStore';

export function Layout() {
  const selectedPageId = useUIStore((s) => s.selectedPageId);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-neutral-900">
      <Sidebar />
      <main className="flex flex-1 flex-col">
        <Editor key={selectedPageId ?? 'empty'} />
      </main>
    </div>
  );
}
