import { useRef, useState } from 'react'
import type { ScheduleData } from '../types'
import { downloadJson, resetToRepoTruth } from '../lib/githubSync'

type ImportMode = 'replace' | 'merge'

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function basicValidate(data: unknown): data is ScheduleData {
  if (!data || typeof data !== 'object') return false
  const d = data as ScheduleData

  if (
    d.version !== 1 ||
    !Array.isArray(d.schedule) ||
    !Array.isArray(d.exams) ||
    !Array.isArray(d.holidays)
  ) {
    return false
  }

  const isValidISODate = (date: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(date)
  const isValidTime = (value: string): boolean => {
    if (!/^\d{2}:\d{2}$/.test(value)) return false
    const [hh, mm] = value.split(':').map((x) => Number(x))
    return (
      Number.isFinite(hh) &&
      Number.isFinite(mm) &&
      hh >= 0 &&
      hh <= 23 &&
      mm >= 0 &&
      mm <= 59
    )
  }
  const toMinutes = (value: string): number => {
    const [hh, mm] = value.split(':').map((x) => Number(x))
    return hh * 60 + mm
  }

  for (const it of d.schedule) {
    if (!it || typeof it !== 'object') return false
    if (!it.id || !it.date || !it.title) return false
    if (!isValidISODate(String(it.date))) return false
    if (String(it.title).trim().length === 0) return false
    if (it.kind !== 'schedule') return false
    if (it.type !== 'meeting' && it.type !== 'trip') return false
    if (it.startTime && !isValidTime(String(it.startTime))) return false
    if (it.endTime && !isValidTime(String(it.endTime))) return false
    if (it.startTime && it.endTime) {
      if (toMinutes(String(it.endTime)) < toMinutes(String(it.startTime))) return false
    }
  }

  for (const it of d.exams) {
    if (!it || typeof it !== 'object') return false
    if (!it.id || !it.date || !it.title) return false
    if (!isValidISODate(String(it.date))) return false
    if (String(it.title).trim().length === 0) return false
    if (it.kind !== 'exam') return false
    if (!it.subject || String(it.subject).trim().length === 0) return false
    if (it.startTime && !isValidTime(String(it.startTime))) return false
    if (it.endTime && !isValidTime(String(it.endTime))) return false
    if (it.startTime && it.endTime) {
      if (toMinutes(String(it.endTime)) < toMinutes(String(it.startTime))) return false
    }
  }

  for (const it of d.holidays) {
    if (!it || typeof it !== 'object') return false
    if (!it.id || !it.date || !it.title) return false
    if (!isValidISODate(String(it.date))) return false
    if (String(it.title).trim().length === 0) return false
    if (it.kind !== 'holiday') return false
    if (!it.reason || String(it.reason).trim().length === 0) return false
  }

  return true
}

function mergeData(base: ScheduleData, incoming: ScheduleData): ScheduleData {
  const byId = <T extends { id: string }>(items: T[]): Map<string, T> =>
    new Map(items.map((i) => [i.id, i]))

  const schedule = byId(base.schedule)
  for (const item of incoming.schedule) schedule.set(item.id, item)

  const exams = byId(base.exams)
  for (const item of incoming.exams) exams.set(item.id, item)

  const holidays = byId(base.holidays)
  for (const item of incoming.holidays) holidays.set(item.id, item)

  return {
    version: 1,
    schedule: Array.from(schedule.values()),
    exams: Array.from(exams.values()),
    holidays: Array.from(holidays.values()),
  }
}

export function JsonTools(props: {
  data: ScheduleData
  setData: (next: ScheduleData) => void
}) {
  const { data, setData } = props
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [importMode, setImportMode] = useState<ImportMode>('replace')
  const [error, setError] = useState<string | null>(null)

  return (
    <section className="mt-4 rounded-2xl bg-white shadow-soft p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-extrabold text-ink-950">כלים (JSON)</h2>
        <span className="text-[12px] text-black/60">LocalStorage בלבד</span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <button
          type="button"
          className="w-full rounded-2xl bg-meeting-600 px-4 py-3 text-white font-extrabold shadow-soft active:scale-[0.99]"
          onClick={() => downloadJson(data, 'schedule.json')}
          aria-label="ייצא JSON כדי לעדכן GitHub"
        >
          ייצא JSON כדי לעדכן GitHub
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-2xl bg-white px-4 py-3 font-extrabold text-ink-950 shadow-soft active:scale-[0.99]"
            onClick={() => inputRef.current?.click()}
            aria-label="ייבא JSON"
          >
            ייבא JSON
          </button>
          <button
            type="button"
            className="flex-1 rounded-2xl bg-white px-4 py-3 font-extrabold text-ink-950 shadow-soft active:scale-[0.99]"
            onClick={() => {
              resetToRepoTruth()
              window.location.reload()
            }}
            aria-label="אפס שינויים מקומיים"
          >
            אפס שינויים מקומיים
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-2xl bg-black/5 px-3 py-2">
          <label className="text-[13px] font-bold text-ink-950" htmlFor="importMode">
            מצב ייבוא:
          </label>
          <select
            id="importMode"
            className="rounded-xl bg-white px-3 py-2 text-[13px] font-bold shadow-soft"
            value={importMode}
            onChange={(e) => setImportMode(e.target.value as ImportMode)}
            aria-label="בחירת מצב ייבוא"
          >
            <option value="replace">החלפה מלאה</option>
            <option value="merge">מיזוג לפי id</option>
          </select>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={async (e) => {
            setError(null)
            const file = e.target.files?.[0]
            if (!file) return
            try {
              const text = await file.text()
              if (!isNonEmptyString(text)) throw new Error('קובץ ריק')
              const parsed = JSON.parse(text)
              if (!basicValidate(parsed)) throw new Error('מבנה JSON לא תקין')
              const next =
                importMode === 'replace' ? parsed : mergeData(data, parsed)
              setData(next)
            } catch (err) {
              setError(err instanceof Error ? err.message : 'שגיאה בייבוא')
            } finally {
              e.target.value = ''
            }
          }}
        />

        {error ? (
          <div className="rounded-2xl bg-red-50 px-3 py-2 text-[13px] font-bold text-red-700">
            {error}
          </div>
        ) : null}
      </div>
    </section>
  )
}
