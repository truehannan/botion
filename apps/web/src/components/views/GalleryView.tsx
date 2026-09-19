import { useDatabaseStore, type DatabaseRow } from '@/stores/databaseStore';

export function GalleryView() {
  const rows = useDatabaseStore((s) => s.rows);

  return (
    <div className="grid grid-cols-2 gap-4 p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {rows.map((row) => (
        <div
          key={row.id}
          className="group cursor-pointer overflow-hidden rounded-lg border border-neutral-100 bg-white transition hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-800/50"
        >
          <div className="aspect-[4/3] bg-neutral-100 dark:bg-neutral-800">
            {row.properties.cover && (
              <img src={row.properties.cover} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="p-3">
            <div className="flex items-center gap-2">
              {row.icon && <span className="text-lg">{row.icon}</span>}
              <span className="text-sm font-medium truncate">{row.title}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
