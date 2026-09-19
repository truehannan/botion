import { useState } from 'react';
import { useDatabaseStore } from '@/stores/databaseStore';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function getDaysInMonth(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstDay.getDay();
  const days: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  return days;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export function CalendarView() {
  const rows = useDatabaseStore((s) => s.rows);
  const [current, setCurrent] = useState(new Date());
  const year = current.getFullYear(), month = current.getMonth();
  const days = getDaysInMonth(year, month);

  return (
    <div className="flex flex-col overflow-auto p-3">
      <div className="mb-3 flex items-center gap-3">
        <button onClick={() => setCurrent(new Date(year, month - 1, 1))}
          className="rounded p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"><ChevronLeft className="h-4 w-4" /></button>
        <span className="text-sm font-medium">{MONTHS[month]} {year}</span>
        <button onClick={() => setCurrent(new Date(year, month + 1, 1))}
          className="rounded p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
          <div key={d} className="px-2 py-1 text-[10px] font-medium uppercase text-neutral-400">{d}</div>
        ))}
        {days.map((d, i) => (
          <div key={i} className="min-h-[5rem] rounded-md border border-neutral-50 p-1 text-xs dark:border-neutral-800/50">
            {d && (
              <>
                <span className="inline-flex h-5 w-5 items-center justify-center text-[10px] font-medium text-neutral-500">{d}</span>
                {rows.filter((r) => {
                  const dateVal = r.properties.date;
                  if (!dateVal) return false;
                  const date = new Date(dateVal);
                  return date.getDate() === d && date.getMonth() === month && date.getFullYear() === year;
                }).map((r) => (
                  <div key={r.id} className="mt-1 truncate rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] text-white dark:bg-neutral-100 dark:text-neutral-900">
                    {r.title}
                  </div>
                ))}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
