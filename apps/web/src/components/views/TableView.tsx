import { useState, useRef, useEffect } from 'react';
import { useDatabaseStore, type Property, type DatabaseRow } from '@/stores/databaseStore';
import { GripVertical, Plus, Trash2 } from 'lucide-react';

function PropertyCell({
  property,
  value,
  onChange,
}: {
  property: Property;
  value: any;
  onChange: (v: any) => void;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  if (property.type === 'checkbox') {
    return (
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-neutral-300 accent-neutral-900"
      />
    );
  }

  if (property.type === 'select') {
    const opts = property.config?.options ?? [];
    return (
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded bg-transparent text-xs outline-none"
      >
        <option value=""></option>
        {opts.map((o: string) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  }

  if (property.type === 'multi_select') {
    const opts = property.config?.options ?? [];
    const vals = Array.isArray(value) ? value : [];
    return (
      <div className="flex flex-wrap gap-1">
        {opts.map((o: string) => {
          const active = vals.includes(o);
          return (
            <button
              key={o}
              onClick={() => {
                const next = active ? vals.filter((v) => v !== o) : [...vals, o];
                onChange(next);
              }}
              className={`rounded-full px-2 py-0.5 text-[10px] transition ${
                active
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                  : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
    );
  }

  if (property.type === 'date') {
    return (
      <input
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded bg-transparent text-xs outline-none"
      />
    );
  }

  if (property.type === 'number') {
    return (
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.valueAsNumber)}
        className="w-full rounded bg-transparent text-xs outline-none"
      />
    );
  }

  if (editing) {
    return (
      <input
        ref={ref}
        type="text"
        defaultValue={value ?? ''}
        onBlur={(e) => { onChange(e.target.value); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onChange((e.target as HTMLInputElement).value);
            setEditing(false);
          }
        }}
        className="w-full rounded bg-transparent text-xs outline-none"
      />
    );
  }

  return (
    <div onDoubleClick={() => setEditing(true)} className="min-h-[1.25rem] cursor-text truncate text-sm">
      {value ?? ''}
    </div>
  );
}

export function TableView() {
  const properties = useDatabaseStore((s) => s.properties);
  const rows = useDatabaseStore((s) => s.rows);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [resizingCol, setResizingCol] = useState<string | null>(null);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!resizingCol) return;
      setColWidths((prev) => ({
        ...prev,
        [resizingCol]: Math.max(80, (prev[resizingCol] ?? 150) + e.movementX),
      }));
    };
    const handleUp = () => setResizingCol(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [resizingCol]);

  const nameWidth = 240;

  return (
    <div className="flex flex-col overflow-auto">
      <div className="flex border-b border-neutral-100 text-xs font-medium text-neutral-400 dark:border-neutral-800">
        <div style={{ width: nameWidth, minWidth: nameWidth }} className="px-3 py-2">Name</div>
        {properties.map((prop) => (
          <div
            key={prop.id}
            className="group relative flex items-center gap-1 px-3 py-2"
            style={{ width: colWidths[prop.id] ?? 150, minWidth: 80 }}
          >
            {prop.name}
            <div
              className="absolute -right-px top-0 h-full w-1 cursor-col-resize opacity-0 group-hover:opacity-100"
              onMouseDown={() => setResizingCol(prop.id)}
            />
          </div>
        ))}
      </div>

      <div className="divide-y divide-neutral-50 dark:divide-neutral-800/50">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
            <div style={{ width: nameWidth, minWidth: nameWidth }} className="flex items-center gap-2 px-3 py-2">
              {row.icon && <span>{row.icon}</span>}
              <span className="truncate">{row.title}</span>
            </div>
            {properties.map((prop) => (
              <div
                key={prop.id}
                className="px-3 py-2"
                style={{ width: colWidths[prop.id] ?? 150, minWidth: 80 }}
              >
                <PropertyCell
                  property={prop}
                  value={row.properties[prop.id]}
                  onChange={(v) => {
                    useDatabaseStore.getState().updateRowProperty(row.id, prop.id, v);
                  }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      <button className="flex items-center gap-2 px-3 py-2 text-xs text-neutral-400 hover:text-neutral-600">
        <Plus className="h-3.5 w-3.5" />
        New row
      </button>
    </div>
  );
}
