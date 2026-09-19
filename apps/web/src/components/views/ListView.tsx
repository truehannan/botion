import { useDatabaseStore, type DatabaseRow } from '@/stores/databaseStore';

export function ListView() {
  const rows = useDatabaseStore((s) => s.rows);

  return (
    <div className="divide-y divide-neutral-50 dark:divide-neutral-800/50">
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800/30"
        >
          {row.icon && <span className="text-base">{row.icon}</span>}
          <span className="truncate">{row.title}</span>
        </div>
      ))}
    </div>
  );
}
