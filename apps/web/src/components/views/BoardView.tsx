import { useState } from 'react';
import { useDatabaseStore, type Property, type DatabaseRow } from '@/stores/databaseStore';
import { GripVertical, Plus, X } from 'lucide-react';

export function BoardView() {
  const properties = useDatabaseStore((s) => s.properties);
  const rows = useDatabaseStore((s) => s.rows);
  const updateRowProperty = useDatabaseStore((s) => s.updateRowProperty);

  // Find status/select property for grouping
  const statusProp =
    properties.find((p) => p.name.toLowerCase().includes('status') && p.type === 'select') ??
    properties.find((p) => p.type === 'select');

  const groups = statusProp
    ? (statusProp.config?.options ?? ['No Status'])
    : ['All'];

  const getGroupForRow = (row: DatabaseRow) => {
    if (!statusProp) return 'All';
    return row.properties[statusProp.id] ?? 'No Status';
  };

  const [dragRowId, setDragRowId] = useState<string | null>(null);

  return (
    <div className="flex h-full gap-3 overflow-auto p-3">
      {groups.map((group) => {
        const groupRows = rows.filter((r) => getGroupForRow(r) === group);
        return (
          <div
            key={group}
            className="flex w-72 shrink-0 flex-col rounded-lg bg-neutral-50 dark:bg-neutral-800/30"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!dragRowId || !statusProp) return;
              updateRowProperty(dragRowId, statusProp.id, group);
              setDragRowId(null);
            }}
          >
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">{group}</span>
              <span className="text-[10px] text-neutral-400">{groupRows.length}</span>
            </div>

            <div className="flex-1 space-y-1.5 p-2 pt-0">
              {groupRows.map((row) => (
                <div
                  key={row.id}
                  draggable
                  onDragStart={() => setDragRowId(row.id)}
                  className="cursor-grab rounded-md border border-neutral-100 bg-white p-3 shadow-sm transition hover:shadow dark:border-neutral-700 dark:bg-neutral-800"
                >
                  <div className="flex items-center gap-2">
                    {row.icon && <span>{row.icon}</span>}
                    <span className="text-sm font-medium truncate">{row.title}</span>
                  </div>
                </div>
              ))}
            </div>

            <button className="flex items-center gap-1.5 px-3 py-2 text-xs text-neutral-400 hover:text-neutral-600">
              <Plus className="h-3.5 w-3.5" />
              New
            </button>
          </div>
        );
      })}
    </div>
  );
}
