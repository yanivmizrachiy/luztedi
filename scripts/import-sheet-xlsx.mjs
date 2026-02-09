import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import xlsx from 'xlsx'

function isoTodayLocal() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function stableSignature(parts) {
  return parts.map((p) => String(p || '').trim()).join('|')
}

function stableIdFromSignature(signature) {
  return `ev-${createHash('sha256').update(signature).digest('hex').slice(0, 20)}`
}

function normalizeWhitespace(s) {
  return String(s || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function normalizeTime(raw) {
  const v = normalizeWhitespace(raw)
  if (!v) return ''
  const m = v.match(/^(\d{1,2})[:.](\d{2})$/)
  if (!m) return ''
  const hh = String(Number(m[1])).padStart(2, '0')
  const mm = m[2]
  return `${hh}:${mm}`
}

function detectTimeRange(text) {
  const t = String(text || '')
  const range = t.match(/(\d{1,2}[:.]\d{2})\s*[–-]\s*(\d{1,2}[:.]\d{2})/)
  if (range) return { startTime: normalizeTime(range[1]), endTime: normalizeTime(range[2]) }
  const single = t.match(/\b(\d{1,2}[:.]\d{2})\b/)
  if (single) return { startTime: normalizeTime(single[1]), endTime: '' }
  return { startTime: '', endTime: '' }
}

function classify(text) {
  const t = String(text || '').toLowerCase()
  const exam = /(מבחן|בוחן|מתכונת|quiz|exam)/.test(t)
  const holiday =
    /(חופשה|חופש|חג|אין\s+לימודים|שביתה|יום\s+חופשי)/.test(t) ||
    /(ט"ו\s*בשבט|ט״ו\s*בשבט|בשבט|פורים|פסח|שבועות|סוכות|חנוכה|ראש\s*השנה|יום\s*כיפור)/.test(t)
  if (exam) return 'exam'
  if (holiday) return 'holiday'
  return 'schedule'
}

function scheduleType(text) {
  const t = String(text || '').toLowerCase()
  if (/(טיול|סיור|מחנה|שדה|מסע|גיחה)/.test(t)) return { type: 'trip', uncertain: false }
  if (/(ישיבה|אסיפה|השתלמות|כנס|פגישה|הרצאה|מפגש)/.test(t))
    return { type: 'meeting', uncertain: false }
  return { type: 'meeting', uncertain: true }
}

function extractSubject(text) {
  const s = normalizeWhitespace(text)
  const m1 = s.match(/(?:מבחן|בוחן|מתכונת)\s*(?:ב|ב־|ב )?(.+?)(?:$|\(|-|–)/)
  if (m1) {
    const v = normalizeWhitespace(m1[1])
    if (v && v.length <= 60) return v
  }
  const m2 = s.match(/(?:מבחן|בוחן|מתכונת)\s*[:：]\s*(.+?)(?:$|\(|-|–)/)
  if (m2) {
    const v = normalizeWhitespace(m2[1])
    if (v && v.length <= 60) return v
  }
  return ''
}

function monthNumberFromHebrew(sheetName) {
  const name = normalizeWhitespace(sheetName)
  const map = {
    'ינואר': 1,
    'פברואר': 2,
    'מרץ': 3,
    'אפריל': 4,
    'מאי': 5,
    'יוני': 6,
    'יולי': 7,
    'אוגוסט': 8,
    'ספטמבר': 9,
    'אוקטובר': 10,
    'נובמבר': 11,
    'דצמבר': 12,
  }
  return map[name] ?? null
}

function guessYearForMonth(month) {
  // Academic year heuristic (Sep-Dec -> previous year, Jan-Aug -> current year)
  const now = new Date()
  const currentYear = now.getFullYear()
  if (month >= 9 && month <= 12) return currentYear - 1
  return currentYear
}

function toISODate(year, month, day) {
  const yyyy = String(year)
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function isLikelyDateRow(row, cols) {
  let hasAny = false
  for (const c of cols) {
    const v = normalizeWhitespace(row[c])
    if (!v) continue
    if (!/^\d{1,2}$/.test(v)) return false
    hasAny = true
  }
  return hasAny
}

function splitMultiEvents(cellText) {
  const t = String(cellText || '').replace(/\r/g, '')
  const parts = t
    .split(/\n+/)
    .map(normalizeWhitespace)
    .filter(Boolean)

  if (!parts.length) return []

  // Some cells have multiple events separated by '/' or '•'
  const expanded = []
  for (const p of parts) {
    const sub = p
      .split(/\s*[•·]\s*/)
      .map(normalizeWhitespace)
      .filter(Boolean)
    if (sub.length > 1) expanded.push(...sub)
    else expanded.push(p)
  }
  return expanded
}

function findExistingBySignature(data, sig) {
  const all = [...data.schedule, ...data.exams, ...data.holidays]
  for (const it of all) {
    if (it._sig === sig) return it
  }
  return null
}

function enrichWithSignatures(data) {
  const wrap = (it, sig) => ({ ...it, _sig: sig })
  return {
    version: 1,
    schedule: data.schedule.map((it) =>
      wrap(
        it,
        stableSignature(['schedule', it.date, it.title, it.startTime || '', it.endTime || '', it.type]),
      ),
    ),
    exams: data.exams.map((it) =>
      wrap(
        it,
        stableSignature(['exam', it.date, it.title, it.startTime || '', it.endTime || '', it.subject]),
      ),
    ),
    holidays: data.holidays.map((it) =>
      wrap(it, stableSignature(['holiday', it.date, it.title, it.reason])),
    ),
  }
}

function mergeNotes(a, b) {
  const out = [a, b].filter(Boolean).join('\n')
  return out.trim() || undefined
}

function upsertBySignature(next, item, sig) {
  // Prefer merging into existing item with same signature, regardless of id.
  const all = [
    ...next.schedule.map((x) => ({ kind: 'schedule', x })),
    ...next.exams.map((x) => ({ kind: 'exam', x })),
    ...next.holidays.map((x) => ({ kind: 'holiday', x })),
  ]

  const found = all.find((o) => o.x._sig === sig)
  if (!found) {
    if (item.kind === 'schedule') next.schedule.push(item)
    if (item.kind === 'exam') next.exams.push(item)
    if (item.kind === 'holiday') next.holidays.push(item)
    return { merged: false }
  }

  const existing = found.x
  const mergedItem = { ...existing, ...item, id: existing.id, notes: mergeNotes(existing.notes, item.notes) }
  if (item.kind === 'schedule') {
    next.schedule = next.schedule.map((x) => (x._sig === sig ? mergedItem : x))
  }
  if (item.kind === 'exam') {
    next.exams = next.exams.map((x) => (x._sig === sig ? mergedItem : x))
  }
  if (item.kind === 'holiday') {
    next.holidays = next.holidays.map((x) => (x._sig === sig ? mergedItem : x))
  }
  return { merged: true }
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

const args = loadArgs()
const xlsxPath = args.xlsx || args.file
if (!xlsxPath) {
  console.error('Usage: node scripts/import-sheet-xlsx.mjs --xlsx <path-to-xlsx>')
  process.exit(1)
}

const absXlsx = path.resolve(process.cwd(), xlsxPath)
const wb = xlsx.readFile(absXlsx)

const schedulePath = path.resolve(process.cwd(), 'data/schedule.json')
const current = JSON.parse(await readFile(schedulePath, 'utf8'))
let next = enrichWithSignatures({
  version: 1,
  schedule: Array.isArray(current.schedule) ? current.schedule : [],
  exams: Array.isArray(current.exams) ? current.exams : [],
  holidays: Array.isArray(current.holidays) ? current.holidays : [],
})

const today = isoTodayLocal()
const uncertain = []
let added = { schedule: 0, exams: 0, holidays: 0 }
let merged = { schedule: 0, exams: 0, holidays: 0 }

for (const sheetName of wb.SheetNames) {
  const month = monthNumberFromHebrew(sheetName)
  if (!month) continue

  const year = guessYearForMonth(month)
  const ws = wb.Sheets[sheetName]

  // Use first row as headers; in this file, headers are day-of-week columns.
  const rows = xlsx.utils.sheet_to_json(ws, { defval: '', raw: false })
  if (!Array.isArray(rows) || rows.length === 0) continue

  const cols = Object.keys(rows[0]).filter((k) => /יום|שבת/.test(k))
  if (!cols.length) continue

  let currentWeekDates = {}

  for (const row of rows) {
    if (isLikelyDateRow(row, cols)) {
      const map = {}
      for (const c of cols) {
        const v = normalizeWhitespace(row[c])
        if (!v) continue
        const day = Number(v)
        if (!Number.isFinite(day) || day < 1 || day > 31) continue
        map[c] = toISODate(year, month, day)
      }
      currentWeekDates = map
      continue
    }

    // Event rows
    for (const c of cols) {
      const date = currentWeekDates[c]
      if (!date || date < today) continue

      const cell = normalizeWhitespace(row[c])
      if (!cell) continue

      const events = splitMultiEvents(cell)
      for (const ev of events) {
        const { startTime, endTime } = detectTimeRange(ev)
        const kind = classify(ev)
        const notes = `מקור: XLSX (${sheetName})\nטקסט מקורי: ${ev}`

        if (kind === 'holiday') {
          const reason = ev
          const sig = stableSignature(['holiday', date, ev, reason])
          const id = stableIdFromSignature(sig)
          const item = { kind: 'holiday', id, date, title: ev, reason, notes, _sig: sig }
          const res = upsertBySignature(next, item, sig)
          if (res.merged) merged.holidays++
          else added.holidays++
          continue
        }

        if (kind === 'exam') {
          const subject = extractSubject(ev) || 'לא צוין'
          const sig = stableSignature(['exam', date, ev, startTime, endTime, subject])
          const id = stableIdFromSignature(sig)
          const item = {
            kind: 'exam',
            id,
            date,
            title: ev,
            subject,
            startTime: startTime || undefined,
            endTime: endTime || undefined,
            notes,
            _sig: sig,
          }
          const res = upsertBySignature(next, item, sig)
          if (res.merged) merged.exams++
          else added.exams++
          if (subject === 'לא צוין') {
            uncertain.push({ source: 'xlsx', reason: 'exam-missing-subject', text: ev, date, sheet: sheetName })
          }
          continue
        }

        const { type, uncertain: typeUncertain } = scheduleType(ev)
        const sig = stableSignature(['schedule', date, ev, startTime, endTime, type])
        const id = stableIdFromSignature(sig)
        const item = {
          kind: 'schedule',
          id,
          date,
          title: ev,
          type,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          notes,
          _sig: sig,
        }
        const res = upsertBySignature(next, item, sig)
        if (res.merged) merged.schedule++
        else added.schedule++
        if (typeUncertain) {
          uncertain.push({ source: 'xlsx', reason: 'schedule-uncertain-type', text: ev, date, sheet: sheetName })
        }
      }
    }
  }
}

// Drop internal signatures before writing
const clean = {
  version: 1,
  schedule: next.schedule.map(({ _sig, ...it }) => it),
  exams: next.exams.map(({ _sig, ...it }) => it),
  holidays: next.holidays.map(({ _sig, ...it }) => it),
}

// Sort
clean.schedule.sort((a, b) => (a.date + (a.startTime ?? '')).localeCompare(b.date + (b.startTime ?? '')))
clean.exams.sort((a, b) => (a.date + (a.startTime ?? '')).localeCompare(b.date + (b.startTime ?? '')))
clean.holidays.sort((a, b) => a.date.localeCompare(b.date))

await writeFile(schedulePath, JSON.stringify(clean, null, 2) + '\n', 'utf8')

await mkdir(path.resolve(process.cwd(), 'data/import-summaries'), { recursive: true })
const summaryPath = path.resolve(process.cwd(), 'data/import-summaries/sheet-xlsx.json')
await writeFile(
  summaryPath,
  JSON.stringify(
    {
      source: 'sheet-xlsx',
      xlsx: absXlsx,
      today,
      added,
      merged,
      uncertainCount: uncertain.length,
      uncertain: uncertain.slice(0, 100),
    },
    null,
    2,
  ) + '\n',
  'utf8',
)

console.log('Import complete')
console.log('Added:', added)
console.log('Merged:', merged)
console.log('Uncertain rows:', uncertain.length)
console.log('Wrote:', path.relative(process.cwd(), summaryPath))
