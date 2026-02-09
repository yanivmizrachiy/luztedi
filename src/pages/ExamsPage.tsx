import { useState } from 'react'
import type { ExamItem, ScheduleData } from '../types'

function parseTimeToMinutes(time: string): number {
  const [hh, mm] = time.split(':').map((x) => Number(x))
  return hh * 60 + mm
}

function sortExams(items: ExamItem[]): ExamItem[] {
  return [...items].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    const at = a.startTime ? parseTimeToMinutes(a.startTime) : -1
    const bt = b.startTime ? parseTimeToMinutes(b.startTime) : -1
    return at - bt
  })
}

export function ExamsPage(props: {
  data: ScheduleData
  onAdd: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  const { data, onAdd, onEdit, onDelete } = props
  const [query, setQuery] = useState('')
  const [classFilter, setClassFilter] = useState('')

  const items = sortExams(data.exams)
  const classOptions = Array.from(
    new Set(items.map((e) => e.className).filter(Boolean) as string[]),
  )

  const filtered = items.filter((e) => {
    const q = query.trim()
    const inQuery =
      !q ||
      e.subject.includes(q) ||
      e.title.includes(q) ||
      (e.notes?.includes(q) ?? false)
    const inClass = !classFilter || e.className === classFilter
    return inQuery && inClass
  })

  return (
    <main className="mx-auto max-w-md px-4 pb-24">
      <section className="mt-4 rounded-2xl bg-white shadow-soft p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-extrabold text-ink-950">לוח מבחנים</h2>
          <button
            type="button"
            className="rounded-2xl bg-ink-950 text-white shadow-soft px-4 py-3 font-extrabold active:scale-[0.99]"
            onClick={onAdd}
            aria-label="הוסף מבחן"
          >
            הוסף
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2">
          <input
            className="w-full rounded-2xl bg-white shadow-soft px-4 py-3 text-[14px] font-bold"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש מהיר..."
            aria-label="חיפוש מבחנים"
          />
          <select
            className="w-full rounded-2xl bg-white shadow-soft px-4 py-3 text-[14px] font-bold"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            aria-label="פילטר לפי כיתה"
          >
            <option value="">כל הכיתות</option>
            {classOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-white shadow-soft p-4 text-[14px] font-bold text-black/60">
            אין מבחנים להצגה.
          </div>
        ) : null}

        {filtered.map((e) => (
          <article
            key={e.id}
            className="rounded-2xl bg-white shadow-card p-4 animate-fadeSlideIn"
            aria-label="מבחן"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[14px] font-extrabold text-black/70">
                  {e.date}
                  {e.startTime ? ` · ${e.startTime}` : ''}
                  {e.endTime ? `–${e.endTime}` : ''}
                </div>
                <div className="mt-1 text-[16px] font-extrabold text-ink-950">
                  {e.subject}
                </div>
                {e.className ? (
                  <div className="mt-1 text-[13px] font-bold text-black/60">
                    כיתה/קבוצה: {e.className}
                  </div>
                ) : null}
                {e.notes ? (
                  <div className="mt-1 text-[13px] font-bold text-black/60">
                    {e.notes}
                  </div>
                ) : null}
              </div>
              <span className="shrink-0 rounded-full bg-black/5 px-3 py-1 text-[12px] font-extrabold text-ink-950">
                מבחן
              </span>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-2xl bg-white px-4 py-2 text-[13px] font-extrabold text-ink-950 shadow-soft active:scale-[0.99]"
                onClick={() => onEdit(e.id)}
                aria-label="ערוך"
              >
                ערוך
              </button>
              <button
                type="button"
                className="flex-1 rounded-2xl bg-white px-4 py-2 text-[13px] font-extrabold text-red-700 shadow-soft active:scale-[0.99]"
                onClick={() => onDelete(e.id)}
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
