import type { HolidayItem, ScheduleData, ScheduleItem } from '../types'
import { getEventColor, getEventLabel } from '../theme'

function isoTodayLocal(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function parseTimeToMinutes(time: string): number {
  const [hh, mm] = time.split(':').map((x) => Number(x))
  return hh * 60 + mm
}

function sortDayItems(items: ScheduleItem[]): ScheduleItem[] {
  const allDay: ScheduleItem[] = []
  const timed: ScheduleItem[] = []
  for (const it of items) {
    if (!it.startTime) allDay.push(it)
    else timed.push(it)
  }
  timed.sort((a, b) =>
    parseTimeToMinutes(a.startTime!) - parseTimeToMinutes(b.startTime!),
  )
  return [...allDay, ...timed]
}

function sortHolidayItems(items: HolidayItem[]): HolidayItem[] {
  return [...items].sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0))
}

function isPast(item: ScheduleItem, now: Date, selectedDate: string): boolean {
  const today = isoTodayLocal()
  if (selectedDate < today) return true
  if (selectedDate > today) return false
  if (!item.startTime) return false
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const end = item.endTime ? parseTimeToMinutes(item.endTime) : null
  const start = parseTimeToMinutes(item.startTime)
  if (end !== null) return end <= nowMin
  return start < nowMin
}

function findNextUp(
  items: ScheduleItem[],
  now: Date,
  selectedDate: string,
): ScheduleItem | null {
  const today = isoTodayLocal()
  if (selectedDate !== today) return null
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const timed = items.filter((i) => i.startTime)
  timed.sort((a, b) =>
    parseTimeToMinutes(a.startTime!) - parseTimeToMinutes(b.startTime!),
  )
  for (const it of timed) {
    const start = parseTimeToMinutes(it.startTime!)
    if (start >= nowMin) return it
  }
  return null
}

export function DailyPage(props: {
  data: ScheduleData
  selectedDate: string
  setSelectedDate: (next: string) => void
  now: Date
  onAdd: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  const {
    data,
    selectedDate,
    setSelectedDate,
    now,
    onAdd,
    onEdit,
    onDelete,
  } = props

  const scheduleForDay = data.schedule.filter((e) => e.date === selectedDate)
  const holidaysForDay = sortHolidayItems(
    data.holidays.filter((h) => h.date === selectedDate),
  )
  const sorted = sortDayItems(scheduleForDay)
  const nextUp = findNextUp(scheduleForDay, now, selectedDate)

  const changeDay = (delta: number) => {
    const d = new Date(`${selectedDate}T00:00:00`)
    d.setDate(d.getDate() + delta)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    setSelectedDate(`${yyyy}-${mm}-${dd}`)
  }

  let startX: number | null = null
  let active = false

  return (
    <main className="mx-auto max-w-md px-4 pb-24">
      <section className="mt-4 rounded-2xl bg-white shadow-soft p-4">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="rounded-2xl bg-white shadow-soft px-4 py-3 font-extrabold active:scale-[0.99]"
            onClick={() => changeDay(-1)}
            aria-label="הקודם"
          >
            הקודם
          </button>
          <button
            type="button"
            className="rounded-2xl bg-ink-950 text-white shadow-soft px-4 py-3 font-extrabold active:scale-[0.99]"
            onClick={() => setSelectedDate(isoTodayLocal())}
            aria-label="היום"
          >
            היום
          </button>
          <button
            type="button"
            className="rounded-2xl bg-white shadow-soft px-4 py-3 font-extrabold active:scale-[0.99]"
            onClick={() => changeDay(1)}
            aria-label="הבא"
          >
            הבא
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="text-[14px] font-extrabold text-ink-950">{selectedDate}</div>
          <button
            type="button"
            className="rounded-2xl bg-meeting-600 px-4 py-3 text-white font-extrabold shadow-soft active:scale-[0.99]"
            onClick={onAdd}
            aria-label="הוסף אירוע"
          >
            הוסף
          </button>
        </div>
      </section>

      <section
        className="mt-4"
        aria-label="רשימת אירועים"
        onPointerDown={(e) => {
          startX = e.clientX
          active = true
        }}
        onPointerUp={(e) => {
          if (!active || startX === null) return
          const dx = e.clientX - startX
          active = false
          startX = null
          if (Math.abs(dx) < 50) return
          if (dx > 0) changeDay(-1)
          else changeDay(1)
        }}
      >
        {nextUp ? (
          <div className="mb-3 rounded-2xl bg-blue-50 px-4 py-3">
            <div className="text-[12px] font-extrabold text-meeting-700">
              האירוע הבא
            </div>
            <div className="mt-1 text-[14px] font-extrabold text-ink-950">
              {nextUp.startTime ? `${nextUp.startTime} · ` : ''}
              {nextUp.title}
            </div>
          </div>
        ) : null}

        {holidaysForDay.length === 0 && sorted.length === 0 ? (
          <div className="rounded-2xl bg-white shadow-soft p-4 text-[14px] font-bold text-black/60">
            אין אירועים לתאריך זה.
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3">
          {holidaysForDay.map((h) => (
            <article
              key={h.id}
              className="rounded-2xl bg-holiday-900 text-white shadow-card p-4 animate-fadeSlideIn"
              aria-label="חופשה"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[18px] font-extrabold">כל היום</div>
                  <div className="mt-1 text-[15px] font-extrabold">{h.title}</div>
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

          {sorted.map((item) => {
            const past = isPast(item, now, selectedDate)
            const c = getEventColor(item.type)
            return (
              <article
                key={item.id}
                className={`rounded-2xl bg-white shadow-card p-4 border-r-8 ${c.border} animate-fadeSlideIn ${past ? 'opacity-50' : 'opacity-100'}`}
                aria-label="אירוע"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[18px] font-extrabold text-ink-950">
                      {item.startTime ? item.startTime : 'כל היום'}
                      {item.endTime ? `–${item.endTime}` : ''}
                    </div>
                    <div className="mt-1 text-[15px] font-extrabold text-ink-950">
                      {item.title}
                    </div>
                    {item.description ? (
                      <div className="mt-1 text-[13px] font-bold text-black/60">
                        {item.description}
                      </div>
                    ) : null}
                    {item.location || item.group ? (
                      <div className="mt-1 text-[13px] font-bold text-black/60">
                        {item.group ? `קבוצה: ${item.group}` : ''}
                        {item.group && item.location ? ' · ' : ''}
                        {item.location ? `מקום: ${item.location}` : ''}
                      </div>
                    ) : null}
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-extrabold ${c.badge}`}
                    aria-label="סוג"
                  >
                    {getEventLabel(item.type)}
                  </span>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="flex-1 rounded-2xl bg-white px-4 py-2 text-[13px] font-extrabold text-ink-950 shadow-soft active:scale-[0.99]"
                    onClick={() => onEdit(item.id)}
                    aria-label="ערוך"
                  >
                    ערוך
                  </button>
                  <button
                    type="button"
                    className="flex-1 rounded-2xl bg-white px-4 py-2 text-[13px] font-extrabold text-red-700 shadow-soft active:scale-[0.99]"
                    onClick={() => onDelete(item.id)}
                    aria-label="מחק"
                  >
                    מחק
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </main>
  )
}
