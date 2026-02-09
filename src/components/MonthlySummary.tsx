import { useMemo, useState } from 'react'
import type { ScheduleData } from '../types'

const LS_KEY = 'luztedi.monthlySummary.open'

function loadOpen(): boolean {
  try {
    const v = window.localStorage.getItem(LS_KEY)
    if (v === null) return true
    return v === '1'
  } catch {
    return true
  }
}

function saveOpen(open: boolean) {
  try {
    window.localStorage.setItem(LS_KEY, open ? '1' : '0')
  } catch {
    // ignore
  }
}

function monthLabel(month: string): string {
  // month: YYYY-MM
  try {
    const d = new Date(`${month}-01T00:00:00`)
    const fmt = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' })
    return fmt.format(d)
  } catch {
    return month
  }
}

export function MonthlySummary(props: { data: ScheduleData }) {
  const { data } = props
  const [open, setOpen] = useState<boolean>(() => loadOpen())

  const rows = useMemo(() => {
    const byMonth = new Map<
      string,
      { month: string; schedule: number; exams: number; holidays: number }
    >()

    const bump = (month: string, key: 'schedule' | 'exams' | 'holidays') => {
      const cur = byMonth.get(month) ?? {
        month,
        schedule: 0,
        exams: 0,
        holidays: 0,
      }
      cur[key] += 1
      byMonth.set(month, cur)
    }

    for (const it of data.schedule) bump(it.date.slice(0, 7), 'schedule')
    for (const it of data.exams) bump(it.date.slice(0, 7), 'exams')
    for (const it of data.holidays) bump(it.date.slice(0, 7), 'holidays')

    return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month))
  }, [data])

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev
      saveOpen(next)
      return next
    })
  }

  if (!rows.length) return null

  const todayMonth = (() => {
    const d = new Date()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return `${yyyy}-${mm}`
  })()

  const current = rows.find((r) => r.month === todayMonth) ?? rows[rows.length - 1]

  return (
    <section className="mx-auto max-w-md px-4 pt-3" aria-label="סיכום חודשי">
      <div className="rounded-2xl bg-white shadow-soft">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="text-[14px] font-extrabold text-ink-950">סיכום חודשי</div>
          <button
            type="button"
            className="rounded-xl bg-ink-950 px-3 py-2 text-[13px] font-bold text-white transition active:scale-[0.98] focus-visible:outline-none"
            onClick={toggle}
            aria-label={open ? 'הסתר סיכום חודשי' : 'הצג סיכום חודשי'}
          >
            {open ? 'הסתר' : 'הצג'}
          </button>
        </div>

        {!open ? (
          <div className="px-4 pb-3">
            <div className="rounded-2xl bg-black/5 px-3 py-2 text-[12px] font-bold text-ink-700">
              {monthLabel(current.month)}: לוז {current.schedule} · מבחנים {current.exams} · חופשות{' '}
              {current.holidays}
            </div>
          </div>
        ) : null}

        {open ? (
          <div className="px-4 pb-3">
            <div className="max-h-40 space-y-2 overflow-auto rounded-2xl bg-black/5 p-3">
              {rows.map((r) => (
                <div
                  key={r.month}
                  className="flex items-baseline justify-between gap-3 rounded-2xl bg-white px-3 py-2"
                >
                  <div className="text-[13px] font-extrabold text-ink-950">
                    {monthLabel(r.month)}
                  </div>
                  <div className="text-[12px] font-bold text-ink-700">
                    לוז {r.schedule} · מבחנים {r.exams} · חופשות {r.holidays}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
