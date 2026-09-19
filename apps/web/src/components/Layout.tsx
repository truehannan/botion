import { Sidebar } from './Sidebar';
import { Editor } from './Editor';
import { PageHeader } from './PageHeader';
import { useUIStore } from '@/stores/uiStore';

export function Layout() {
  const selectedPageId = useUIStore((s) => s.selectedPageId);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <Sidebar />
      <main className="flex flex-1 flex-col">
        <PageHeader />
        <Editor key={selectedPageId ?? 'empty'} />
      </main>
    </div>
  );
}
