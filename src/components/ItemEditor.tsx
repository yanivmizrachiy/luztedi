import { useMemo, useState } from 'react'
import type {
  AnyItem,
  ExamItem,
  HolidayItem,
  ScheduleData,
  ScheduleItem,
} from '../types'

export type EditorPreset =
  | { mode: 'create'; kind: AnyItem['kind']; defaultDate: string }
  | { mode: 'edit'; id: string }

type TimeFields = {
  startTime?: string
  endTime?: string
}

function isValidISODate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
}

function isValidTime(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false
  const [hh, mm] = value.split(':').map((x) => Number(x))
  return Number.isFinite(hh) && Number.isFinite(mm) && hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59
}

function toMinutes(value: string): number {
  const [hh, mm] = value.split(':').map((x) => Number(x))
  return hh * 60 + mm
}

function createId(): string {
  return crypto.randomUUID()
}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  const idx = items.findIndex((x) => x.id === item.id)
  if (idx === -1) return [...items, item]
  const next = [...items]
  next[idx] = item
  return next
}

export function ItemEditor(props: {
  preset: EditorPreset
  items: AnyItem[]
  data: ScheduleData
  onClose: () => void
  onSave: (next: ScheduleData) => void
  onResetLocal: () => void
}) {
  const { preset, items, data, onClose, onSave, onResetLocal } = props

  const initial = useMemo(() => {
    if (preset.mode === 'create') {
      if (preset.kind === 'schedule') {
        const it: ScheduleItem = {
          kind: 'schedule',
          id: createId(),
          date: preset.defaultDate as any,
          title: '',
          type: 'meeting',
        }
        return it as AnyItem
      }
      if (preset.kind === 'exam') {
        const it: ExamItem = {
          kind: 'exam',
          id: createId(),
          date: preset.defaultDate as any,
          title: '',
          subject: '',
        }
        return it as AnyItem
      }
      const it: HolidayItem = {
        kind: 'holiday',
        id: createId(),
        date: preset.defaultDate as any,
        title: '',
        reason: '',
      }
      return it as AnyItem
    }
    const found = items.find((x) => x.id === preset.id)
    if (!found) {
      const it: HolidayItem = {
        kind: 'holiday',
        id: preset.id,
        date: preset.id as any,
        title: '',
        reason: '',
      }
      return it
    }
    return found
  }, [items, preset])

  const [kind, setKind] = useState<AnyItem['kind']>(initial.kind)
  const [date, setDate] = useState<string>(initial.date)
  const [title, setTitle] = useState<string>(initial.title)
  const [startTime, setStartTime] = useState<string>((initial as any).startTime ?? '')
  const [endTime, setEndTime] = useState<string>((initial as any).endTime ?? '')
  const [group, setGroup] = useState<string>(initial.group ?? '')
  const [location, setLocation] = useState<string>(initial.location ?? '')
  const [notes, setNotes] = useState<string>(initial.notes ?? '')

  const [scheduleType, setScheduleType] = useState<'meeting' | 'trip'>(
    initial.kind === 'schedule' ? initial.type : 'meeting',
  )
  const [description, setDescription] = useState<string>(
    initial.kind === 'schedule' ? initial.description ?? '' : '',
  )

  const [subject, setSubject] = useState<string>(
    initial.kind === 'exam' ? initial.subject : '',
  )
  const [className, setClassName] = useState<string>(
    initial.kind === 'exam' ? initial.className ?? '' : '',
  )

  const [reason, setReason] = useState<string>(
    initial.kind === 'holiday' ? initial.reason : '',
  )

  const [error, setError] = useState<string | null>(null)

  const timeFields: TimeFields = {
    startTime: startTime.trim() || undefined,
    endTime: endTime.trim() || undefined,
  }

  const validate = (): boolean => {
    setError(null)
    if (!date.trim() || !isValidISODate(date.trim())) {
      setError('תאריך חובה בפורמט YYYY-MM-DD')
      return false
    }
    if (!title.trim()) {
      setError('כותרת היא שדה חובה')
      return false
    }
    if (timeFields.startTime && !isValidTime(timeFields.startTime)) {
      setError('שעת התחלה לא תקינה (HH:MM)')
      return false
    }
    if (timeFields.endTime && !isValidTime(timeFields.endTime)) {
      setError('שעת סיום לא תקינה (HH:MM)')
      return false
    }
    if (timeFields.startTime && timeFields.endTime) {
      if (toMinutes(timeFields.endTime) < toMinutes(timeFields.startTime)) {
        setError('שעת סיום חייבת להיות אחרי שעת התחלה')
        return false
      }
    }

    if (kind === 'holiday' && !reason.trim()) {
      setError('סיבת חופשה היא שדה חובה')
      return false
    }
    if (kind === 'exam' && !subject.trim()) {
      setError('מקצוע/נושא הוא שדה חובה')
      return false
    }
    return true
  }

  const saveItem = () => {
    if (!validate()) return

    if (kind === 'schedule') {
      const next: ScheduleItem = {
        kind: 'schedule',
        id: initial.id,
        date: date.trim() as any,
        title: title.trim(),
        type: scheduleType,
        description: description.trim() || undefined,
        group: group.trim() || undefined,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
        startTime: timeFields.startTime as any,
        endTime: timeFields.endTime as any,
      }

      onSave({
        ...data,
        schedule: upsertById(data.schedule, next),
      })
      return
    }

    if (kind === 'exam') {
      const next: ExamItem = {
        kind: 'exam',
        id: initial.id,
        date: date.trim() as any,
        title: title.trim(),
        subject: subject.trim(),
        className: className.trim() || undefined,
        group: group.trim() || undefined,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
        startTime: timeFields.startTime as any,
        endTime: timeFields.endTime as any,
      }

      onSave({
        ...data,
        exams: upsertById(data.exams, next),
      })
      return
    }

    const next: HolidayItem = {
      kind: 'holiday',
      id: initial.id,
      date: date.trim() as any,
      title: title.trim(),
      reason: reason.trim(),
      notes: notes.trim() || undefined,
      group: group.trim() || undefined,
      location: location.trim() || undefined,
    }
    onSave({
      ...data,
      holidays: upsertById(data.holidays, next),
    })
  }

  const inputBase =
    'w-full rounded-2xl bg-white shadow-soft px-4 py-3 text-[14px] font-bold text-ink-950'

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="עריכת פריט">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-md">
        <div className="rounded-t-3xl bg-white shadow-card px-4 pt-4 pb-6">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[15px] font-extrabold text-ink-950">
              {preset.mode === 'create' ? 'הוספה' : 'עריכה'}
            </div>
            <button
              type="button"
              className="rounded-2xl bg-white shadow-soft px-4 py-2 text-[13px] font-extrabold"
              onClick={onClose}
              aria-label="סגור"
            >
              סגור
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2">
            {preset.mode === 'create' ? (
              <select
                className={inputBase}
                value={kind}
                onChange={(e) => setKind(e.target.value as AnyItem['kind'])}
                aria-label="סוג"
              >
                <option value="schedule">לוז</option>
                <option value="exam">מבחן</option>
                <option value="holiday">חופשה</option>
              </select>
            ) : null}

            <input
              className={inputBase}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="תאריך (YYYY-MM-DD)"
              aria-label="תאריך"
              inputMode="numeric"
            />

            <input
              className={inputBase}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="כותרת (חובה)"
              aria-label="כותרת"
            />

            {kind === 'schedule' ? (
              <select
                className={inputBase}
                value={scheduleType}
                onChange={(e) => setScheduleType(e.target.value as 'meeting' | 'trip')}
                aria-label="סוג אירוע"
              >
                <option value="meeting">ישיבה</option>
                <option value="trip">טיול</option>
              </select>
            ) : null}

            {kind === 'exam' ? (
              <input
                className={inputBase}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="מקצוע/נושא (חובה)"
                aria-label="מקצוע"
              />
            ) : null}

            {kind === 'exam' ? (
              <input
                className={inputBase}
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="כיתה/שכבה/קבוצה (אופציונלי)"
                aria-label="כיתה"
              />
            ) : null}

            {kind === 'holiday' ? (
              <input
                className={inputBase}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="סיבת חופשה (חובה)"
                aria-label="סיבת חופשה"
              />
            ) : null}

            {kind === 'schedule' ? (
              <input
                className={inputBase}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="תיאור/מקום/קבוצה (אופציונלי)"
                aria-label="תיאור"
              />
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <input
                className={inputBase}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="שעת התחלה (HH:MM)"
                aria-label="שעת התחלה"
                inputMode="numeric"
              />
              <input
                className={inputBase}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                placeholder="שעת סיום (HH:MM)"
                aria-label="שעת סיום"
                inputMode="numeric"
              />
            </div>

            <input
              className={inputBase}
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              placeholder="שכבה/כיתה/קבוצה (אופציונלי)"
              aria-label="קבוצה"
            />

            <input
              className={inputBase}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="מקום (אופציונלי)"
              aria-label="מקום"
            />

            <textarea
              className={`${inputBase} min-h-[88px] resize-none`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הערות (אופציונלי)"
              aria-label="הערות"
            />

            {error ? (
              <div className="rounded-2xl bg-red-50 px-3 py-2 text-[13px] font-bold text-red-700">
                {error}
              </div>
            ) : null}

            <button
              type="button"
              className="w-full rounded-2xl bg-ink-950 px-4 py-3 text-white font-extrabold shadow-soft active:scale-[0.99]"
              onClick={saveItem}
              aria-label="שמור"
            >
              שמור
            </button>

            <button
              type="button"
              className="w-full rounded-2xl bg-white px-4 py-3 font-extrabold text-ink-950 shadow-soft active:scale-[0.99]"
              onClick={onResetLocal}
              aria-label="אפס שינויים מקומיים"
            >
              אפס שינויים מקומיים
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
