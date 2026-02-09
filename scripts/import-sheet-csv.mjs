import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import Papa from 'papaparse'

function isoTodayLocal() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function stableId(input) {
  return `sheet-${createHash('sha256').update(input).digest('hex').slice(0, 20)}`
}

function pick(obj, keys) {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

function normalizeKind(raw) {
  const v = String(raw || '').trim().toLowerCase()
  if (['schedule', 'לוז', 'אירוע'].includes(v)) return 'schedule'
  if (['exam', 'מבחן', 'מבחנים'].includes(v)) return 'exam'
  if (['holiday', 'חופשה', 'חגים', 'יום מיוחד'].includes(v)) return 'holiday'
  return ''
}

function normalizeScheduleType(raw) {
  const v = String(raw || '').trim().toLowerCase()
  if (['meeting', 'ישיבה'].includes(v)) return 'meeting'
  if (['trip', 'טיול'].includes(v)) return 'trip'
  return ''
}

function isISODate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
}

function normalizeTime(raw) {
  const v = String(raw || '').trim()
  if (!v) return ''
  const m = v.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return ''
  const hh = String(Number(m[1])).padStart(2, '0')
  const mm = m[2]
  return `${hh}:${mm}`
}

function loadArgs() {
  const args = process.argv.slice(2)
  const out = {}
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith('--')) {
      out[a.slice(2)] = args[i + 1]
      i++
    }
  }
  return out
}

function upsertById(items, item) {
  const idx = items.findIndex((x) => x.id === item.id)
  if (idx === -1) return [...items, item]
  const next = [...items]
  next[idx] = item
  return next
}

const args = loadArgs()
const csvPath = args.csv
if (!csvPath) {
  console.error('Usage: node scripts/import-sheet-csv.mjs --csv <path-to-csv>')
  process.exit(1)
}

const today = isoTodayLocal()
const absCsv = path.resolve(process.cwd(), csvPath)

const csvText = await readFile(absCsv, 'utf8')
const parsed = Papa.parse(csvText, {
  header: true,
  skipEmptyLines: true,
})

if (parsed.errors?.length) {
  console.error('CSV parse errors:', parsed.errors)
  process.exit(1)
}

const rows = parsed.data

const schedulePath = path.resolve(process.cwd(), 'data/schedule.json')
const current = JSON.parse(await readFile(schedulePath, 'utf8'))

let next = {
  version: 1,
  schedule: Array.isArray(current.schedule) ? current.schedule : [],
  exams: Array.isArray(current.exams) ? current.exams : [],
  holidays: Array.isArray(current.holidays) ? current.holidays : [],
}

for (const row of rows) {
  const date = pick(row, ['date', 'Date', 'תאריך'])
  if (!isISODate(date)) continue
  if (date < today) continue

  const kind = normalizeKind(pick(row, ['kind', 'Kind', 'סוג', 'קטגוריה']))
  if (!kind) continue

  const title = pick(row, ['title', 'Title', 'כותרת', 'שם'])
  if (!title) continue

  const startTime = normalizeTime(
    pick(row, ['startTime', 'Start', 'שעת התחלה', 'התחלה', 'שעה']),
  )
  const endTime = normalizeTime(
    pick(row, ['endTime', 'End', 'שעת סיום', 'סיום']),
  )

  const group = pick(row, ['group', 'Group', 'קבוצה', 'שכבה'])
  const location = pick(row, ['location', 'Location', 'מקום'])
  const notes = pick(row, ['notes', 'Notes', 'הערות'])

  if (kind === 'schedule') {
    const t = normalizeScheduleType(pick(row, ['type', 'Type', 'סוג אירוע']))
    if (!t) continue
    const description = pick(row, ['description', 'Description', 'תיאור'])

    const id = stableId(`${kind}|${t}|${date}|${startTime}|${endTime}|${title}`)
    const item = {
      kind: 'schedule',
      id,
      date,
      title,
      type: t,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      group: group || undefined,
      location: location || undefined,
      notes: notes || undefined,
      description: description || undefined,
    }
    next.schedule = upsertById(next.schedule, item)
    continue
  }

  if (kind === 'exam') {
    const subject = pick(row, ['subject', 'Subject', 'מקצוע', 'נושא'])
    if (!subject) continue
    const className = pick(row, ['className', 'Class', 'כיתה'])
    const id = stableId(`${kind}|${date}|${startTime}|${endTime}|${subject}|${title}`)
    const item = {
      kind: 'exam',
      id,
      date,
      title,
      subject,
      className: className || undefined,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      group: group || undefined,
      location: location || undefined,
      notes: notes || undefined,
    }
    next.exams = upsertById(next.exams, item)
    continue
  }

  if (kind === 'holiday') {
    const reason = pick(row, ['reason', 'Reason', 'סיבה', 'סיבת חופשה'])
    if (!reason) continue
    const id = stableId(`${kind}|${date}|${reason}|${title}`)
    const item = {
      kind: 'holiday',
      id,
      date,
      title,
      reason,
      notes: notes || undefined,
      group: group || undefined,
      location: location || undefined,
    }
    next.holidays = upsertById(next.holidays, item)
  }
}

await writeFile(schedulePath, JSON.stringify(next, null, 2) + '\n', 'utf8')
console.log(`Updated data/schedule.json (kept ${today} and onward)`) 
