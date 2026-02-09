import type { HolidayItem, ScheduleData } from '../types'

function sortHolidays(items: HolidayItem[]): HolidayItem[] {
  return [...items].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

export function HolidaysPage(props: {
  data: ScheduleData
  onAdd: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  const { data, onAdd, onEdit, onDelete } = props
  const items = sortHolidays(data.holidays)

  return (
    <main className="mx-auto max-w-md px-4 pb-24">
      <section className="mt-4 rounded-2xl bg-white shadow-soft p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-extrabold text-ink-950">לוח חופשות</h2>
          <button
            type="button"
            className="rounded-2xl bg-holiday-900 text-white shadow-soft px-4 py-3 font-extrabold active:scale-[0.99]"
            onClick={onAdd}
            aria-label="הוסף חופשה"
          >
            הוסף
          </button>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-3">
        {items.length === 0 ? (
          <div className="rounded-2xl bg-white shadow-soft p-4 text-[14px] font-bold text-black/60">
            אין חופשות להצגה.
          </div>
        ) : null}

        {items.map((h) => (
          <article
            key={h.id}
            className="rounded-2xl bg-holiday-900 text-white shadow-card p-4 animate-fadeSlideIn"
            aria-label="חופשה"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[14px] font-extrabold text-white/85">{h.date}</div>
                <div className="mt-1 text-[16px] font-extrabold">{h.title}</div>
                <div className="mt-2 text-[13px] font-extrabold text-white">
                  סיבה: {h.reason}
                </div>
                {h.notes ? (
                  <div className="mt-1 text-[13px] font-bold text-white/85">{h.notes}</div>
                ) : null}
              </div>
              <span className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-[12px] font-extrabold">
                חופשה
              </span>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-2xl bg-white/10 px-4 py-2 text-[13px] font-extrabold text-white shadow-soft active:scale-[0.99]"
                onClick={() => onEdit(h.id)}
                aria-label="ערוך"
              >
                ערוך
              </button>
              <button
                type="button"
                className="flex-1 rounded-2xl bg-white/10 px-4 py-2 text-[13px] font-extrabold text-white shadow-soft active:scale-[0.99]"
                onClick={() => onDelete(h.id)}
                aria-label="מחק"
              >
                מחק
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
