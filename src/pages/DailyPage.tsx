import type { AnyItem, ExamItem, HolidayItem, ScheduleData, ScheduleItem } from '../types'
import { getEventColor, getEventLabel } from '../theme'
import { useMemo } from 'react'

const HIDE_TIMES_FROM_ISO = '2026-03-15'

const hebrewDateFormatter = new Intl.DateTimeFormat('he-u-ca-hebrew', {
  day: 'numeric',
  month: 'long',
})

const hebrewSmallCache = new Map<string, string>()

function parseTimeToMinutes(time: string): number {
  const [hh, mm] = time.split(':').map((x) => Number(x))
  return hh * 60 + mm
}

function normalizeTitleForKey(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/["'׳״]/g, '')
    .replace(/[[\]–—:.,!()?{}-]/g, ' ')
    .replace(/\s+/g, ' ')

  const words = base.split(' ').filter(Boolean)

  for (let i = 0; i < words.length; i++) {
    if (words[i] === 'אורינות') words[i] = 'אוריינות'
  }

  const isTraining = words.includes('השתלמות')
  const cleanedWords = isTraining ? words.filter((w) => w !== 'סיום') : words

  return cleanedWords.join(' ')
}

function isIsoTime(value: string): boolean {
  return /^\d{1,2}:\d{2}$/.test(value)
}

function toPaddedIsoTime(value: string): string {
  const [hRaw, mRaw] = value.split(':')
  const hh = String(Number(hRaw)).padStart(2, '0')
  const mm = String(Number(mRaw)).padStart(2, '0')
  return `${hh}:${mm}`
}

function deriveTimeFromNotes(notes?: string): { startTime?: string; endTime?: string; label?: string } {
  if (!notes) return {}
  const m = notes.match(/שעה \(מקורי\):\s*([^\n\r]+)/)
  const raw = (m?.[1] ?? '').trim()
  if (!raw || raw === 'לא צוין') return {}

  const range = raw.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/)
  if (range && isIsoTime(range[1]) && isIsoTime(range[2])) {
    return { startTime: toPaddedIsoTime(range[1]), endTime: toPaddedIsoTime(range[2]) }
  }

  const single = raw.match(/(\d{1,2}:\d{2})/)
  if (single && isIsoTime(single[1])) {
    return { startTime: toPaddedIsoTime(single[1]) }
  }

  if (raw.includes('בוקר')) return { label: 'בוקר' }
  return {}
}

function dedupeDayItems(items: ScheduleItem[]): ScheduleItem[] {
  const byKey = new Map<string, ScheduleItem[]>()
  for (const it of items) {
    const key = `${it.date}|${normalizeTitleForKey(it.title)}`
    const arr = byKey.get(key) ?? []
    arr.push(it)
    byKey.set(key, arr)
  }

  const bestOf = (group: ScheduleItem[]): ScheduleItem => {
    const score = (it: ScheduleItem) => {
      let s = 0
      if (it.type === 'trip') s += 3
      if (it.startTime) s += 10
      if (it.endTime) s += 5
      if (it.description) s += 2
      if (it.location) s += 1
      if (it.group) s += 1
      s += Math.min(3, Math.floor((it.notes?.length ?? 0) / 120))
      return s
    }

    const sorted = [...group].sort((a, b) => score(b) - score(a))
    const base = sorted[0]
    const notesParts = new Set<string>()
    for (const it of group) {
      for (const line of (it.notes ?? '').split('\n')) {
        const v = line.trim()
        if (v) notesParts.add(v)
      }
    }
    const mergedNotes = notesParts.size ? [...notesParts].join('\n') : undefined
    return mergedNotes ? { ...base, notes: mergedNotes } : base
  }

  return [...byKey.values()].map(bestOf)
}

function sortDayItems(items: ScheduleItem[]): ScheduleItem[] {
  return [...items].sort((a, b) => {
    const at = a.startTime ? parseTimeToMinutes(a.startTime) : Number.POSITIVE_INFINITY
    const bt = b.startTime ? parseTimeToMinutes(b.startTime) : Number.POSITIVE_INFINITY
    if (at !== bt) return at - bt
    return a.title < b.title ? -1 : a.title > b.title ? 1 : 0
  })
}

function weekdayName(d: Date): string {
  return ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][d.getDay()] ?? ''
}

function formatNumericDateShortYear(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  const yy = (y ?? '').slice(-2)
  return `${d}.${m}.${yy}`
}

function formatWeekdayWithPrefix(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`)
  return `יום ${weekdayName(d)}`
}

function formatHolidayRangePrimary(startIso: string, endIso: string): string {
  const a = new Date(`${startIso}T00:00:00`)
  const b = new Date(`${endIso}T00:00:00`)
  const wa = weekdayName(a)
  const wb = weekdayName(b)

  const daysPart = wa === wb ? `יום ${wa}` : `ימים ${wa} עד ${wb}`

  const datePart = `${formatNumericDateShortYear(startIso)}-${formatNumericDateShortYear(endIso)}`
  return `${daysPart} · ${datePart}`
}

function toHebrewNumeral(n: number): string {
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט']
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ']
  if (!Number.isFinite(n) || n <= 0) return ''
  if (n < 10) return ones[n] ?? ''
  if (n === 10) return 'י'
  if (n === 15) return 'טו'
  if (n === 16) return 'טז'
  if (n < 20) return `י${ones[n - 10] ?? ''}`
  if (n % 10 === 0) return tens[n / 10] ?? ''
  return `${tens[Math.floor(n / 10)] ?? ''}${ones[n % 10] ?? ''}`
}

function cleanHebrewMonth(value: string): string {
  return value
    .replace(/^ב/, '')
    .replace(/["׳״]/g, '')
    .trim()
}

function isTodayIsoDate(isoDate: string): boolean {
  const now = new Date()
  const yyyy = String(now.getFullYear())
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return isoDate === `${yyyy}-${mm}-${dd}`
}

function formatDateTitle(isoDate: string): string {
  const base = `${formatWeekdayWithPrefix(isoDate)} · ${formatNumericDateShortYear(isoDate)}`
  return isTodayIsoDate(isoDate) ? `היום ${base}` : base
}

function formatHebrewDateSmall(isoDate: string): string {
  const cached = hebrewSmallCache.get(isoDate)
  if (cached !== undefined) return cached
  try {
    const d = new Date(`${isoDate}T00:00:00`)
    const parts = hebrewDateFormatter.formatToParts(d)
    const dayRaw = parts.find((p) => p.type === 'day')?.value ?? ''
    const monthRaw = parts.find((p) => p.type === 'month')?.value ?? ''
    const dayNum = Number(dayRaw.replace(/[^0-9]/g, ''))
    const day = toHebrewNumeral(dayNum)
    const month = cleanHebrewMonth(monthRaw)
    if (!day || !month) {
      hebrewSmallCache.set(isoDate, '')
      return ''
    }
    const v = `${day} ${month}`
    hebrewSmallCache.set(isoDate, v)
    return v
  } catch {
    hebrewSmallCache.set(isoDate, '')
    return ''
  }
}

function formatHebrewRangeSmall(startIso: string, endIso: string): string {
  if (startIso === endIso) return formatHebrewDateSmall(startIso)
  const a = formatHebrewDateSmall(startIso)
  const b = formatHebrewDateSmall(endIso)
  if (!a || !b) return ''
  const [ad, ...am] = a.split(' ')
  const [bd, ...bm] = b.split(' ')
  const ams = am.join(' ').trim()
  const bms = bm.join(' ').trim()
  if (ams && ams === bms) return `${ad}-${bd} ${ams}`
  return `${a}-${b}`
}

function monthKeyFromIsoDate(isoDate: string): string {
  const [y, m] = isoDate.split('-')
  return `${y}-${m}`
}

function monthLabelFromKey(key: string): string {
  const [y, m] = key.split('-').map((x) => Number(x))
  const d = new Date(`${String(y)}-${String(m).padStart(2, '0')}-01T00:00:00`)
  return new Intl.DateTimeFormat('he-IL', { month: 'long' }).format(d)
}

type TimelineSlot = {
  kind: AnyItem['kind']
  id: string
  date: string
  startTime?: string
  endTime?: string
  timeLabel?: string
  range?: { start: string; end: string }
  title: string
  subtitle?: string
  badge: string
  color: { border: string; badge: string; text: string }
  raw: AnyItem
}

function isTripSlot(slot: TimelineSlot): boolean {
  return slot.kind === 'schedule' && (slot.raw as ScheduleItem).type === 'trip'
}

function mergeTripRanges(slots: TimelineSlot[]): TimelineSlot[] {
  const out: TimelineSlot[] = []

  for (let i = 0; i < slots.length; i++) {
    const cur = slots[i]
    if (!isTripSlot(cur) || cur.range) {
      out.push(cur)
      continue
    }

    let end = cur.date
    let j = i
    while (j + 1 < slots.length) {
      const nxt = slots[j + 1]
      if (
        isTripSlot(nxt) &&
        !nxt.range &&
        normalizeTitleForKey(nxt.title) === normalizeTitleForKey(cur.title) &&
        isNextDayIsoDate(end, nxt.date)
      ) {
        end = nxt.date
        j++
      } else {
        break
      }
    }

    if (j > i) {
      out.push({
        ...cur,
        id: `trip-range-${normalizeTitleForKey(cur.title)}-${cur.date}-${end}`,
        range: { start: cur.date, end },
        startTime: undefined,
        endTime: undefined,
        timeLabel: undefined,
      })
      i = j
      continue
    }

    out.push(cur)
  }

  return out
}

function IsraelFlagIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 24"
      aria-hidden="true"
      className={props.className}
      focusable="false"
    >
      <rect x="0" y="0" width="36" height="24" rx="3" fill="white" />
      <rect x="0" y="2" width="36" height="4" fill="#1d4ed8" />
      <rect x="0" y="18" width="36" height="4" fill="#1d4ed8" />
      <path
        d="M18 7.2l4.4 7.6H13.6L18 7.2z"
        fill="none"
        stroke="#1d4ed8"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M18 16.8l-4.4-7.6h8.8L18 16.8z"
        fill="none"
        stroke="#1d4ed8"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <rect x="0.7" y="0.7" width="34.6" height="22.6" rx="2.6" fill="none" stroke="rgba(11,18,32,0.10)" />
    </svg>
  )
}

function isPesachHoliday(h: HolidayItem): boolean {
  const t = `${h.title} ${h.reason}`
  return t.includes('פסח')
}

function isPurimHoliday(h: HolidayItem): boolean {
  const t = `${h.title} ${h.reason}`
  return t.includes('פורים')
}

function isNextDayIsoDate(a: string, b: string): boolean {
  try {
    const da = new Date(`${a}T00:00:00`)
    const db = new Date(`${b}T00:00:00`)
    const diffDays = Math.round((db.getTime() - da.getTime()) / (24 * 60 * 60 * 1000))
    return diffDays === 1
  } catch {
    return false
  }
}

function consolidateHolidayRanges(holidays: HolidayItem[]): {
  singles: HolidayItem[]
  ranges: Array<{ title: string; start: HolidayItem['date']; end: HolidayItem['date'] }>
} {
  const byKey = new Map<string, HolidayItem[]>()
  for (const h of holidays) {
    const key = `${normalizeTitleForKey(h.title)}|${normalizeTitleForKey(h.reason ?? '')}`
    const arr = byKey.get(key) ?? []
    arr.push(h)
    byKey.set(key, arr)
  }

  const singles: HolidayItem[] = []
  const ranges: Array<{ title: string; start: HolidayItem['date']; end: HolidayItem['date'] }> = []

  for (const group of byKey.values()) {
    const sorted = [...group].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    let start = sorted[0]
    let end = sorted[0]

    const flush = () => {
      if (start.date === end.date) singles.push(start)
      else ranges.push({ title: start.title, start: start.date, end: end.date })
    }

    for (let i = 1; i < sorted.length; i++) {
      const cur = sorted[i]
      if (isNextDayIsoDate(end.date, cur.date)) {
        end = cur
      } else {
        flush()
        start = cur
        end = cur
      }
    }

    flush()
  }

  return { singles, ranges }
}

function buildPesachSummary(
  holidays: HolidayItem[],
): { start: HolidayItem['date']; end: HolidayItem['date'] } | null {
  if (!holidays.length) return null
  const dates = holidays.map((h) => h.date).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  return { start: dates[0], end: dates[dates.length - 1] }
}

function buildPurimSummary(
  holidays: HolidayItem[],
): { start: HolidayItem['date']; end: HolidayItem['date'] } | null {
  if (!holidays.length) return null
  const dates = holidays.map((h) => h.date).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  return { start: dates[0], end: dates[dates.length - 1] }
}

function buildDaySlots(params: {
  date: string
  schedule: ScheduleItem[]
  exams: ExamItem[]
  holidays: HolidayItem[]
}): TimelineSlot[] {
  const { date, schedule, exams, holidays } = params

  const holidaySlots: TimelineSlot[] = holidays.map((h) => ({
    kind: 'holiday',
    id: h.id,
    date,
    title: h.title,
    subtitle: h.reason,
    badge: 'חופשה',
    color: getEventColor('holiday'),
    raw: h,
  }))

  const timedSlots: TimelineSlot[] = []
  const untimedSlots: TimelineSlot[] = []

  for (const s of schedule) {
    const fromNotes = !s.startTime ? deriveTimeFromNotes(s.notes) : {}
    const start = s.startTime ?? fromNotes.startTime
    const end = s.endTime ?? fromNotes.endTime
    const timeLabel = !start ? fromNotes.label : undefined
    const slot: TimelineSlot = {
      kind: 'schedule',
      id: s.id,
      date,
      startTime: start,
      endTime: end,
      timeLabel,
      title: s.title,
      subtitle:
        s.location || s.group
          ? [s.group ? `קבוצה: ${s.group}` : '', s.location ? `מקום: ${s.location}` : '']
              .filter(Boolean)
              .join(' · ')
          : s.description,
      badge: getEventLabel(s.type),
      color: getEventColor(s.type),
      raw: s,
    }
    if (slot.startTime) timedSlots.push(slot)
    else untimedSlots.push(slot)
  }

  for (const e of exams) {
    const fromNotes = !e.startTime ? deriveTimeFromNotes(e.notes) : {}
    const start = e.startTime ?? fromNotes.startTime
    const end = e.endTime ?? fromNotes.endTime
    const timeLabel = !start ? fromNotes.label : undefined
    const slot: TimelineSlot = {
      kind: 'exam',
      id: e.id,
      date,
      startTime: start,
      endTime: end,
      timeLabel,
      title: e.subject,
      subtitle: e.className ? `כיתה/קבוצה: ${e.className}` : e.title,
      badge: 'מבחן',
      color: { border: 'border-black/10', badge: 'bg-ink-950 text-white', text: 'text-ink-950' },
      raw: e,
    }
    if (slot.startTime) timedSlots.push(slot)
    else untimedSlots.push(slot)
  }

  timedSlots.sort((a, b) => parseTimeToMinutes(a.startTime!) - parseTimeToMinutes(b.startTime!))
  untimedSlots.sort((a, b) => {
    if (a.badge !== b.badge) return a.badge < b.badge ? -1 : 1
    if (a.title !== b.title) return a.title < b.title ? -1 : 1
    return a.id < b.id ? -1 : 1
  })

  return [...holidaySlots, ...timedSlots, ...untimedSlots]
}

function sortTimeline(slots: TimelineSlot[]): TimelineSlot[] {
  return [...slots].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    const at = a.startTime
      ? parseTimeToMinutes(a.startTime)
      : a.kind === 'holiday'
        ? -1
        : Number.POSITIVE_INFINITY
    const bt = b.startTime
      ? parseTimeToMinutes(b.startTime)
      : b.kind === 'holiday'
        ? -1
        : Number.POSITIVE_INFINITY
    if (at !== bt) return at - bt
    return a.title < b.title ? -1 : a.title > b.title ? 1 : 0
  })
}

export function DailyPage(props: { data: ScheduleData }) {
  const { data } = props

  const timeline = useMemo(() => {
    const byDate = new Map<
      string,
      { schedule: ScheduleItem[]; exams: ExamItem[]; holidays: HolidayItem[] }
    >()

    const ensure = (date: string) => {
      const cur = byDate.get(date) ?? { schedule: [], exams: [], holidays: [] }
      byDate.set(date, cur)
      return cur
    }

    const pesach: HolidayItem[] = []
    const purim: HolidayItem[] = []
    const otherHolidays: HolidayItem[] = []
    for (const s of data.schedule) ensure(s.date).schedule.push(s)
    for (const e of data.exams) ensure(e.date).exams.push(e)
    for (const h of data.holidays) {
      if (isPesachHoliday(h)) pesach.push(h)
      else if (isPurimHoliday(h)) purim.push(h)
      else otherHolidays.push(h)
    }

    const consolidated = consolidateHolidayRanges(otherHolidays)
    for (const h of consolidated.singles) ensure(h.date).holidays.push(h)

    const dates = [...byDate.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    const allSlots: TimelineSlot[] = []

    const pesachSummary = buildPesachSummary(pesach)
    if (pesachSummary) {
      allSlots.push({
        kind: 'holiday',
        id: `holiday-pesach-${pesachSummary.start}-${pesachSummary.end}`,
        date: pesachSummary.start,
        range: { start: pesachSummary.start, end: pesachSummary.end },
        title: 'חופשת פסח',
        subtitle: undefined,
        badge: 'חופשה',
        color: getEventColor('holiday'),
        raw: {
          kind: 'holiday',
          id: `holiday-pesach-${pesachSummary.start}-${pesachSummary.end}`,
          date: pesachSummary.start,
          title: 'חופשת פסח',
          reason: 'פסח',
        },
      })
    }

    const purimSummary = buildPurimSummary(purim)
    if (purimSummary) {
      allSlots.push({
        kind: 'holiday',
        id: `holiday-purim-${purimSummary.start}-${purimSummary.end}`,
        date: purimSummary.start,
        range: { start: purimSummary.start, end: purimSummary.end },
        title: 'חופשת פורים',
        subtitle: undefined,
        badge: 'חופשה',
        color: getEventColor('holiday'),
        raw: {
          kind: 'holiday',
          id: `holiday-purim-${purimSummary.start}-${purimSummary.end}`,
          date: purimSummary.start,
          title: 'חופשת פורים',
          reason: 'פורים',
        },
      })
    }

    for (const r of consolidated.ranges) {
      allSlots.push({
        kind: 'holiday',
        id: `holiday-range-${normalizeTitleForKey(r.title)}-${r.start}-${r.end}`,
        date: r.start,
        range: { start: r.start, end: r.end },
        title: r.title,
        subtitle: undefined,
        badge: 'חופשה',
        color: getEventColor('holiday'),
        raw: {
          kind: 'holiday',
          id: `holiday-range-${normalizeTitleForKey(r.title)}-${r.start}-${r.end}`,
          date: r.start,
          title: r.title,
          reason: 'חופשה',
        },
      })
    }

    for (const date of dates) {
      const day = byDate.get(date)!
      const schedule = sortDayItems(dedupeDayItems(day.schedule))
      const slots = buildDaySlots({ date, schedule, exams: day.exams, holidays: day.holidays })
      allSlots.push(...slots)
    }

    return mergeTripRanges(sortTimeline(allSlots))
  }, [data])

  const monthOrder = useMemo(
    () => ['02', '03', '04', '05', '06'],
    [],
  )
  const monthTargets = useMemo(() => {
    const keys = new Set<string>()
    for (const slot of timeline) {
      const key = monthKeyFromIsoDate(slot.date)
      const m = key.split('-')[1]
      if (monthOrder.includes(m)) keys.add(key)
    }
    const years = [...keys].map((k) => k.split('-')[0])
    const year = years.sort()[0] ?? String(new Date().getFullYear())
    return monthOrder.map((m) => `${year}-${m}`)
  }, [timeline, monthOrder])

  const scrollToMonth = (key: string) => {
    const el = document.getElementById(`month-${key}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <main className="mx-auto max-w-md px-4 pb-10" aria-label="לוז כרונולוגי">
      <nav
        className="mt-4 w-full rounded-2xl bg-ink-950/90 backdrop-blur shadow-soft p-2 ring-1 ring-white/10"
        aria-label="ניווט חודשים"
        dir="ltr"
      >
        <div className="flex flex-row gap-2">
          {monthTargets.map((key) => {
            const exists = timeline.some((s) => monthKeyFromIsoDate(s.date) === key)
            const monthNum = key.split('-')[1] ?? ''
            const monthBg =
              monthNum === '02'
                ? 'bg-meeting-600'
                : monthNum === '03'
                  ? 'bg-training-700'
                  : monthNum === '04'
                    ? 'bg-trip-600'
                    : monthNum === '05'
                      ? 'bg-meeting-700'
                      : 'bg-ink-950'
            const label = monthLabelFromKey(key)
            return (
              <button
                key={key}
                type="button"
                disabled={!exists}
                onClick={() => scrollToMonth(key)}
                className={`flex-1 rounded-2xl px-4 py-3 text-[14px] font-extrabold shadow-card ring-1 transition-transform duration-200 ease-out active:scale-[0.98] focus-visible:outline-none ${
                  exists
                    ? `${monthBg} text-white ring-black/5`
                    : `${monthBg}/60 text-white/35 shadow-none cursor-not-allowed ring-white/10`
                }`}
                aria-label={`חודש ${label}`}
                title={label}
              >
                <span className="block whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <section className="mt-4">
        {timeline.length === 0 ? (
          <div className="rounded-2xl bg-white shadow-soft p-4 text-[14px] font-bold text-black/60">
            אין אירועים להצגה.
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3">
          {timeline.map((slot, idx) => {
            const curMonth = monthKeyFromIsoDate(slot.date)
            const prevMonth = idx > 0 ? monthKeyFromIsoDate(timeline[idx - 1].date) : null
            const showMonthDivider = prevMonth !== curMonth
            const primaryLine = slot.range
              ? formatHolidayRangePrimary(slot.range.start, slot.range.end)
              : formatDateTitle(slot.date)
            const hebrewSmall = slot.range
              ? formatHebrewRangeSmall(slot.range.start, slot.range.end)
              : formatHebrewDateSmall(slot.date)

            const slotDateForTime = slot.range?.start ?? slot.date
            const showTime = slot.kind !== 'holiday' && slotDateForTime < HIDE_TIMES_FROM_ISO
            const timeText =
              showTime && slot.startTime
                ? slot.endTime
                  ? `${slot.startTime}–${slot.endTime}`
                  : `בשעה ${slot.startTime}`
                : showTime
                  ? slot.timeLabel
                  : undefined

            const isTraining =
              slot.kind === 'schedule' && normalizeTitleForKey(slot.title).includes('השתלמות')
            const isIndependenceDay = normalizeTitleForKey(slot.title).includes('יום העצמאות')
            const isReportCardsDay = normalizeTitleForKey(slot.title).includes('חלוקת תעודות')
            const isDarkButton = slot.kind === 'holiday' || isIndependenceDay || isReportCardsDay

            const baseButton =
              slot.kind === 'holiday'
                ? 'bg-green-900 text-white'
                : isIndependenceDay
                  ? 'bg-meeting-700 text-white'
                  : isReportCardsDay
                    ? 'bg-holiday-900 text-white'
                  : 'bg-white text-ink-950'

            return (
              <div key={slot.id} aria-label="משבצת אירוע">
                {showMonthDivider ? (
                  <div
                    id={`month-${curMonth}`}
                    className="mb-2 mt-1 rounded-2xl bg-white shadow-soft px-4 py-3"
                    aria-label="כותרת חודש"
                  >
                    <div className="text-[14px] font-extrabold text-ink-950">
                      {monthLabelFromKey(curMonth)}
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  className={`relative w-full rounded-2xl shadow-card p-4 motion-safe:animate-fadeSlideIn transition-transform duration-200 ease-out active:scale-[0.99] focus-visible:outline-none border-r-8 ${slot.color.border} ${baseButton}`}
                  aria-label="אירוע"
                  dir="rtl"
                >
                  {isIndependenceDay ? (
                    <div
                      className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
                      aria-hidden="true"
                    >
                      <div className="absolute left-5 right-5 top-3 h-[3px] bg-white/25" />
                      <div className="absolute left-5 right-5 top-6 h-[3px] bg-white/15" />
                      <div className="absolute left-5 right-5 bottom-6 h-[3px] bg-white/15" />
                      <div className="absolute left-5 right-5 bottom-3 h-[3px] bg-white/25" />
                    </div>
                  ) : null}

                  <div className="flex flex-col items-center text-center gap-2">
                    {timeText && !isTraining ? (
                      <div
                        className={`rounded-full px-3 py-1 text-[12px] font-extrabold ring-1 drop-shadow-sm ${
                          isDarkButton
                            ? 'bg-white/15 text-white ring-white/15'
                            : 'bg-ink-950 text-white ring-black/10'
                        }`}
                        aria-label="זמן"
                      >
                        {timeText}
                      </div>
                    ) : null}

                      <div
                        className={`text-[15px] font-extrabold tracking-wide drop-shadow-sm ${
                          isDarkButton ? 'text-white' : 'text-ink-950'
                        }`}
                      >
                        {primaryLine}
                      </div>

                      {hebrewSmall ? (
                        <div
                          className={`text-[11px] font-bold ${
                            isDarkButton ? 'text-white/75' : 'text-black/45'
                          }`}
                        >
                          {hebrewSmall}
                        </div>
                      ) : null}

                      <div
                        className={`mt-1 text-[15px] font-bold ${
                          isDarkButton ? 'text-white/90' : 'text-black/70'
                        }`}
                      >
                        {isIndependenceDay ? (
                          <span className="inline-flex items-center justify-center gap-2">
                            <IsraelFlagIcon className="h-4 w-6" />
                            <span>{slot.title}</span>
                          </span>
                        ) : (
                          slot.title
                        )}
                      </div>

                      {timeText && isTraining ? (
                        <div
                          className={`text-[13px] font-extrabold ${
                            isDarkButton ? 'text-white/85' : 'text-black/60'
                          }`}
                          aria-label="זמן"
                        >
                          {timeText}
                        </div>
                      ) : null}

                      {slot.subtitle ? (
                        <div
                          className={`text-[13px] font-bold ${
                            isDarkButton ? 'text-white/85' : 'text-black/60'
                          }`}
                        >
                          {slot.subtitle}
                        </div>
                      ) : null}

                      {slot.kind === 'holiday' ? (
                        <span
                          className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-[12px] font-extrabold text-white"
                          aria-label="חופשה"
                        >
                          חופשה
                        </span>
                      ) : isTraining ? (
                        <span
                          className="mt-1 flex h-12 w-12 items-center justify-center rounded-full bg-training-700 px-1 text-[10px] font-extrabold leading-tight text-training-50"
                          aria-label="השתלמות"
                        >
                          השתלמות
                        </span>
                      ) : (
                        <span
                          className={`mt-1 rounded-full px-3 py-1 text-[12px] font-extrabold ${slot.color.badge}`}
                          aria-label="סוג"
                        >
                          {slot.badge}
                        </span>
                      )}
                  </div>
                </button>
              </div>
            )
          })}
        </div>
      </section>
    </main>
  )
}
