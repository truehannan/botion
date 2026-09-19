import { useState } from 'react';
import { useDatabaseStore } from '@/stores/databaseStore';
import { TableView } from '../views/TableView';
import { BoardView } from '../views/BoardView';
import { GalleryView } from '../views/GalleryView';
import { ListView } from '../views/ListView';
import { CalendarView } from '../views/CalendarView';
import { Table, LayoutGrid, List, Calendar, Clock, KanbanSquare, Plus } from 'lucide-react';

const VIEW_ICONS: Record<string, React.ReactNode> = {
  table: <Table className="h-3.5 w-3.5" />,
  board: <KanbanSquare className="h-3.5 w-3.5" />,
  gallery: <LayoutGrid className="h-3.5 w-3.5" />,
  list: <List className="h-3.5 w-3.5" />,
  calendar: <Calendar className="h-3.5 w-3.5" />,
  timeline: <Clock className="h-3.5 w-3.5" />,
};

function ActiveView({ type }: { type: string }) {
  switch (type) {
    case 'table': return <TableView />;
    case 'board': return <BoardView />;
    case 'gallery': return <GalleryView />;
    case 'list': return <ListView />;
    case 'calendar': return <CalendarView />;
    default: return <TableView />;
  }
}

export function DatabaseEngine({ parentPageId }: { parentPageId: string }) {
  const databases = useDatabaseStore((s) => s.databases);
  const views = useDatabaseStore((s) => s.views);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  const db = databases.find((d) => d.parent_page_id === parentPageId);
  const dbViews = views.filter((v) => v.database_id === db?.id);
  const activeView = dbViews.find((v) => v.id === activeViewId) ?? dbViews[0];

  return (
    <div className="my-4 rounded-lg border border-neutral-100 dark:border-neutral-800">
      <div className="flex items-center gap-1 border-b border-neutral-100 px-3 py-2 dark:border-neutral-800">
        {dbViews.map((v) => (
          <button
            key={v.id}
            onClick={() => setActiveViewId(v.id)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
              activeView?.id === v.id
                ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
                : 'text-neutral-500 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-800/50'
            }`}
          >
            {VIEW_ICONS[v.type]}
            {v.name}
          </button>
        ))}
        <button className="ml-auto rounded p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-h-[12rem]">
        {activeView ? (
          <ActiveView type={activeView.type} />
        ) : (
          <div className="p-8 text-center text-xs text-neutral-400">No views configured.</div>
        )}
      </div>
    </div>
  );
}
